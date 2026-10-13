"""Keep expiring cloud download credentials out of mirrored story URLs."""
import re
from urllib.parse import unquote_plus, urlsplit, urlunsplit


def sanitize_url(value):
    if not isinstance(value, str):
        return ''
    try:
        url = urlsplit(value)
    except ValueError:
        # Invalid URLs already fall back to the discussion in the browser.
        return '' if re.search(r'x-(?:amz|goog)-|awsaccesskeyid|googleaccessid', value, re.I) else value
    parts = url.query.split('&')
    names = [unquote_plus(part.split('=', 1)[0]).lower() for part in parts]
    signed = any(name.startswith(('x-amz-', 'x-goog-')) or name in ('awsaccesskeyid', 'googleaccessid') for name in names)
    if not signed:
        return value
    # Use the article page instead of an expired ScienceDirect PDF download.
    if url.hostname == 'pdf.sciencedirectassets.com':
        identifiers = re.findall(r'/1-s2\.0-([A-Za-z0-9]+)(?=/)', url.path)
        if identifiers:
            return f'https://www.sciencedirect.com/science/article/pii/{identifiers[-1]}'
    auth_names = {'awsaccesskeyid', 'googleaccessid', 'signature', 'expires', 'securitytoken', 'sessiontoken'}
    kept = [part for part, name in zip(parts, names)
            if not name.startswith(('x-amz-', 'x-goog-')) and name not in auth_names]
    return urlunsplit(url._replace(query='&'.join(kept)))
