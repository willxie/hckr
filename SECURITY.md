# Archived URL safety

hrnw mirrors public story links. It does not require AWS credentials, API keys, or signing tokens.

The October 13, 2026 secret-scanning alert identified a temporary AWS access-key ID embedded in a third-party ScienceDirect PDF URL in the January 19, 2020 archive. The URL was signed at 19:01:11 UTC with a 300-second expiry, ending at 19:06:11 UTC that day. It was an expired publisher download link, rather than an application credential. The current archive uses the permanent ScienceDirect article page instead. Old commits retain the historical expired URL; history was not rewritten.

Three archived cloud download links were sanitized. The feed parser and archive importer remove AWS/Google signing parameters before persistence, preserving unrelated query parameters and fragments. Signed ScienceDirect PDF links resolve to permanent article pages. Other signed links retain their unsigned object URL; private objects may require visiting the original discussion for an updated link.

GitHub Actions checks existing data before updates, sanitizes imported data after updates, and retains GitHub secret scanning. Regression tests cover current and legacy signing schemes, canonical article links, ordinary URLs, import paths, read-only verification, and idempotent cleanup.

Run a read-only audit with:

```sh
python3 scripts/sanitize_urls.py --check
```

Sanitize persisted records with:

```sh
python3 scripts/sanitize_urls.py
```

References: [AWS presigned URL expiration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [temporary AWS credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html), and [GitHub alert resolution](https://docs.github.com/en/code-security/how-tos/manage-security-alerts/manage-secret-scanning-alerts/resolving-alerts).
