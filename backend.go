package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

type request map[string]any

type gitStatus struct {
	Branch string `json:"branch"`
	Dirty  int    `json:"dirty"`
}

type changedFile struct {
	Path      string `json:"path"`
	OldPath   string `json:"oldPath,omitempty"`
	Status    string `json:"status"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

type commit struct {
	Hash       string        `json:"hash"`
	ShortHash  string        `json:"shortHash"`
	AuthorName string        `json:"authorName"`
	Date       string        `json:"date"`
	Refs       []string      `json:"refs"`
	Subject    string        `json:"subject"`
	Files      []changedFile `json:"files"`
	Additions  int           `json:"additions"`
	Deletions  int           `json:"deletions"`
}

func main() {
	method := arg(1)
	root := arg(2)
	input, err := readInput(os.Stdin)
	if err != nil {
		fail(err)
	}
	if root == "" {
		fail(errors.New("workspace root is required"))
	}

	switch method {
	case "history":
		limit := intInput(input, "limit", 30)
		commits, err := history(root, limit)
		if err != nil {
			fail(err)
		}
		respond(map[string]any{"status": status(root), "commits": commits})
	case "commit":
		detail, err := commitDetail(root, stringInput(input, "hash"))
		if err != nil {
			fail(err)
		}
		respond(detail)
	default:
		fail(fmt.Errorf("unknown method: %s", method))
	}
}

func arg(index int) string {
	if len(os.Args) <= index {
		return ""
	}
	return os.Args[index]
}

func readInput(reader io.Reader) (request, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(data)) == 0 {
		return request{}, nil
	}
	var input request
	return input, json.Unmarshal(data, &input)
}

func respond(value any) {
	if err := json.NewEncoder(os.Stdout).Encode(value); err != nil {
		fail(err)
	}
}

func stringInput(input request, key string) string {
	value, _ := input[key].(string)
	return value
}

func intInput(input request, key string, fallback int) int {
	value, ok := input[key].(float64)
	if !ok {
		return fallback
	}
	parsed := int(value)
	if parsed < 1 {
		return fallback
	}
	if parsed > 180 {
		return 180
	}
	return parsed
}

func git(root string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = root
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			message = err.Error()
		}
		return "", errors.New(message)
	}
	return string(output), nil
}

func status(root string) gitStatus {
	branch, err := git(root, "branch", "--show-current")
	if err != nil || strings.TrimSpace(branch) == "" {
		branch = "detached"
	}
	porcelain, err := git(root, "status", "--porcelain=v1", "-z")
	if err != nil {
		return gitStatus{Branch: strings.TrimSpace(branch), Dirty: 0}
	}
	dirty := 0
	for _, item := range strings.Split(porcelain, "\x00") {
		if item != "" {
			dirty++
		}
	}
	return gitStatus{Branch: strings.TrimSpace(branch), Dirty: dirty}
}

func history(root string, limit int) ([]commit, error) {
	log, err := git(root, "log", fmt.Sprintf("-%d", limit), "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e")
	if err != nil {
		return nil, err
	}
	return parseHistory(root, log)
}

func parseHistory(root, output string) ([]commit, error) {
	rows := strings.Split(output, "\x1e")
	commits := make([]commit, 0, len(rows))
	for _, row := range rows {
		row = strings.TrimSpace(row)
		if row == "" {
			continue
		}
		parts := strings.Split(row, "\x1f")
		if len(parts) < 6 {
			continue
		}
		files := changedFiles(root, parts[0])
		additions, deletions := totalChanges(files)
		commits = append(commits, commit{
			Hash: parts[0], ShortHash: parts[1], AuthorName: parts[2], Date: parts[3],
			Refs: parseRefs(parts[4]), Subject: parts[5], Files: files, Additions: additions, Deletions: deletions,
		})
	}
	return commits, nil
}

func commitDetail(root, hash string) (map[string]any, error) {
	if len(hash) < 7 || len(hash) > 40 {
		return nil, errors.New("commit hash is required")
	}
	log, err := git(root, "log", "-1", "--date=iso-strict", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e", hash)
	if err != nil {
		return nil, err
	}
	commits, err := parseHistory(root, log)
	if err != nil {
		return nil, err
	}
	if len(commits) == 0 {
		return nil, errors.New("commit not found")
	}
	body, _ := git(root, "show", "--format=%B", "--no-patch", hash)
	diff, _ := git(root, "show", "--format=", "--find-renames", "--patch", "--stat", hash)
	return map[string]any{"commit": commits[0], "body": strings.TrimSpace(body), "diff": diff, "truncated": false}, nil
}

func changedFiles(root, hash string) []changedFile {
	output, err := git(root, "show", "--format=", "--numstat", "--name-status", "--find-renames", hash)
	if err != nil {
		return []changedFile{}
	}
	statuses := map[string]string{}
	oldPaths := map[string]string{}
	files := []changedFile{}
	for _, line := range strings.Split(output, "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) >= 2 && strings.Contains("AMDRC", parts[0][:1]) {
			path := parts[1]
			if len(parts) > 2 {
				oldPaths[parts[2]] = parts[1]
				path = parts[2]
			}
			statuses[path] = statusName(parts[0])
			continue
		}
		if len(parts) >= 3 {
			path := parts[2]
			if len(parts) > 3 {
				path = parts[3]
			}
			files = append(files, changedFile{Path: path, OldPath: oldPaths[path], Status: fallbackStatus(statuses[path]), Additions: count(parts[0]), Deletions: count(parts[1])})
		}
	}
	return files
}

func statusName(code string) string {
	if strings.HasPrefix(code, "A") {
		return "added"
	}
	if strings.HasPrefix(code, "D") {
		return "deleted"
	}
	if strings.HasPrefix(code, "R") {
		return "renamed"
	}
	return "modified"
}

func fallbackStatus(value string) string {
	if value == "" {
		return "modified"
	}
	return value
}

func count(value string) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}

func totalChanges(files []changedFile) (int, int) {
	additions := 0
	deletions := 0
	for _, file := range files {
		additions += file.Additions
		deletions += file.Deletions
	}
	return additions, deletions
}

func parseRefs(value string) []string {
	refs := []string{}
	for _, ref := range strings.Split(value, ",") {
		ref = strings.TrimSpace(ref)
		if ref != "" {
			refs = append(refs, ref)
		}
	}
	return refs
}

func fail(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err.Error())
	os.Exit(1)
}
