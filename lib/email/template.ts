export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function todijoEmailTemplate(input: {
  preview: string;
  heading: string;
  greeting: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  fallbackLabel: string;
  securityNote: string;
  supportLabel: string;
  copyright: string;
}) {
  const safe = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, escapeEmailHtml(value)])) as Record<keyof typeof input, string>;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${safe.heading}</title></head><body style="margin:0;background:#f2f8f5;color:#14352b;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${safe.preview}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f8f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dcebe4;border-radius:18px;overflow:hidden"><tr><td style="padding:24px 30px;background:#075b43;color:#fff;font-size:26px;font-weight:800">Todijo<span style="color:#59d2a4">.</span></td></tr><tr><td style="padding:32px 30px"><h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;color:#103b2f">${safe.heading}</h1><p style="margin:0 0 14px;font-size:16px;line-height:1.65">${safe.greeting}</p><p style="margin:0 0 24px;font-size:16px;line-height:1.65">${safe.body}</p><p style="margin:0 0 24px"><a href="${safe.ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#0b9368;color:#fff;text-decoration:none;font-weight:700">${safe.ctaLabel}</a></p><p style="margin:0 0 8px;color:#60766e;font-size:13px;line-height:1.5">${safe.fallbackLabel}</p><p style="margin:0 0 24px;word-break:break-all;font-size:13px;line-height:1.5"><a href="${safe.ctaUrl}" style="color:#087653">${safe.ctaUrl}</a></p><div style="padding:14px;border-radius:12px;background:#eef8f4;color:#48645a;font-size:13px;line-height:1.55">${safe.securityNote}</div></td></tr><tr><td style="padding:20px 30px;border-top:1px solid #e3eee9;color:#667c74;font-size:12px;line-height:1.6"><a href="mailto:support@todijo.com" style="color:#087653">${safe.supportLabel}</a><br>${safe.copyright}</td></tr></table></td></tr></table></body></html>`;
  const text = `${input.heading}\n\n${input.greeting}\n\n${input.body}\n\n${input.ctaLabel}: ${input.ctaUrl}\n\n${input.securityNote}\n\n${input.supportLabel}\n${input.copyright}`;
  return { html, text };
}
