# GitLab fonts

The unmodified WOFF2 files and license texts in this directory come from
[`@gitlab/fonts` 1.3.1](https://www.npmjs.com/package/@gitlab/fonts/v/1.3.1),
published by the
[GitLab fonts project](https://gitlab.com/gitlab-org/frontend/fonts).

- GitLab Sans is based on Inter. See `gitlab-sans/LICENSE.txt` for copyright
  notices and the SIL Open Font License 1.1.
- GitLab Mono is based on JetBrains Mono. See `gitlab-mono/OFL.txt` for
  copyright notices and the SIL Open Font License 1.1.

OFL 1.1 permits bundling, embedding, and redistributing these fonts with
software when each copy includes its copyright notice and license. The fonts
remain under OFL 1.1 and cannot be sold by themselves.

Vite copies this directory into the client distribution, which is embedded in
the compiled Sadoku binary. While Sadoku is running, the license texts can be
read at `/assets/fonts/gitlab-sans/LICENSE.txt` and
`/assets/fonts/gitlab-mono/OFL.txt` (with any deployment prefix prepended).
