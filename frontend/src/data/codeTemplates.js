/**
 * codeTemplates — SINGLE source of truth for coding-workspace metadata.
 *
 * Sprint 7 Commit 3: language keys match the backend DSA language enum
 * (see backend/src/constants/dsa.js). For each language we store:
 *
 *   monacoLanguage — Monaco Editor's language id for syntax highlighting
 *   extension      — file extension used by Download Code
 *   label          — human display name for the language selector
 *   boilerplate    — starter code loaded when the editor is untouched
 *
 * Nothing else in the app should hard-code these mappings. Adding a
 * language = adding an entry here.
 */

export const CODE_LANGUAGES = [
  {
    value: 'cpp',
    label: 'C++',
    monacoLanguage: 'cpp',
    extension: 'cpp',
    boilerplate: `#include <bits/stdc++.h>
using namespace std;

int main() {

    return 0;
}
`,
  },
  {
    value: 'java',
    label: 'Java',
    monacoLanguage: 'java',
    extension: 'java',
    boilerplate: `public class Main {
    public static void main(String[] args) {

    }
}
`,
  },
  {
    value: 'python',
    label: 'Python',
    monacoLanguage: 'python',
    extension: 'py',
    boilerplate: `def solve():
    pass


if __name__ == "__main__":
    solve()
`,
  },
  {
    value: 'javascript',
    label: 'JavaScript',
    monacoLanguage: 'javascript',
    extension: 'js',
    boilerplate: `function solve() {
  // your solution here
}

solve();
`,
  },
  {
    value: 'typescript',
    label: 'TypeScript',
    monacoLanguage: 'typescript',
    extension: 'ts',
    boilerplate: `function solve(): void {
  // your solution here
}

solve();
`,
  },
  {
    value: 'go',
    label: 'Go',
    monacoLanguage: 'go',
    extension: 'go',
    boilerplate: `package main

import "fmt"

func solve() {
    // your solution here
}

func main() {
    solve()
    _ = fmt.Sprintf
}
`,
  },
  {
    value: 'rust',
    label: 'Rust',
    monacoLanguage: 'rust',
    extension: 'rs',
    boilerplate: `fn solve() {
    // your solution here
}

fn main() {
    solve();
}
`,
  },
  {
    value: 'csharp',
    label: 'C#',
    monacoLanguage: 'csharp',
    extension: 'cs',
    boilerplate: `using System;

class Solution {
    static void Solve() {
        // your solution here
    }

    static void Main() {
        Solve();
    }
}
`,
  },
  {
    value: 'kotlin',
    label: 'Kotlin',
    monacoLanguage: 'kotlin',
    extension: 'kt',
    boilerplate: `fun solve() {
    // your solution here
}

fun main() {
    solve()
}
`,
  },
];

const BY_VALUE = new Map(CODE_LANGUAGES.map((l) => [l.value, l]));

/**
 * Look up a language descriptor by its value (e.g. "cpp"). Falls back to
 * C++ if the requested value is missing so consumers never crash on a
 * bad DSA config from a legacy interview.
 */
export function getLanguage(value) {
  return BY_VALUE.get(String(value || '').toLowerCase()) || BY_VALUE.get('cpp');
}

export function getBoilerplate(value) {
  return getLanguage(value).boilerplate;
}

export function getMonacoLanguage(value) {
  return getLanguage(value).monacoLanguage;
}

export function getExtension(value) {
  return getLanguage(value).extension;
}
