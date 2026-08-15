# Todijo transactional email deliverability

## Repository findings

- SMTP is sent through Nodemailer using `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` and `SMTP_PASS`.
- The visible sender is `SMTP_FROM`, defaulting to `Todijo <noreply@todijo.com>`.
- Reply-To is `SMTP_REPLY_TO`, defaulting to `support@todijo.com`.
- Password-reset mail contains matching HTML and plain-text bodies and reuses the localized transactional template.
- Reset links are generated from `APP_URL`; production rejects non-HTTPS origins. Production must set the canonical origin to `https://todijo.com` unless the canonical public host intentionally differs.
- No SMTP credential, DKIM private key or OAuth secret belongs in the repository.

## Operator checks before judging Outlook/Hotmail placement

1. In the SMTP provider, verify `todijo.com` as an authorized sending domain and confirm that the actual RFC5322 From address is `noreply@todijo.com`.
2. Publish the provider's exact SPF include/value. Keep a single SPF TXT record and verify it authorizes the real SMTP envelope sender.
3. Enable DKIM in the provider, publish the exact selector/public-key records it supplies, and confirm test messages show `dkim=pass` with `d=todijo.com` (or an aligned subdomain). Never place the DKIM private key in Git.
4. Publish and monitor DMARC for `_dmarc.todijo.com`. Start with the operator/provider-approved monitoring policy, aggregate-report mailbox and alignment settings; tighten policy only after both SPF/DKIM alignment are proven.
5. Inspect Outlook message headers for `spf=pass`, `dkim=pass`, `dmarc=pass`, aligned Header From/envelope/DKIM domains, TLS delivery and the expected `Message-ID` domain.
6. Verify reverse DNS/PTR, HELO/EHLO and shared-IP reputation with the SMTP provider. These are provider controls, not repository changes.
7. Verify `SMTP_FROM`, `SMTP_REPLY_TO` and `APP_URL` in the production secret manager without printing their values in logs.
8. Send controlled seed tests to Outlook, Gmail and another mailbox; check Microsoft SNDS/JMRP or the provider's reputation tooling when available.

The current reset subject/body is concise, transactional and contains no attachment, tracking pixel or marketing copy. Repository changes cannot guarantee inbox placement: authentication alignment, IP/domain reputation, recipient engagement and Microsoft filtering remain external configuration concerns.
