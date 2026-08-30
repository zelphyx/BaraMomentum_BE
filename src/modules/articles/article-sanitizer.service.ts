import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sanitizeHtml = require('sanitize-html');
import { loadEnvConfig } from '../../config/configuration';

@Injectable()
export class ArticleSanitizerService {
  private readonly allowedDomains: string[];

  constructor() {
    const env = loadEnvConfig();
    const cdnHost = new URL(env.CDN_BASE_URL).host;
    this.allowedDomains = [cdnHost, ...env.INLINE_IMAGE_ALLOWED_DOMAINS.map((d) => new URL(`https://${d}`).host)];
  }

  sanitize(rawHtml: string): string {
    const clean = sanitizeHtml(rawHtml, {
      allowedTags: [
        'p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li', 'blockquote', 'a', 'img',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'width', 'height'],
      },
      allowedSchemes: ['https', 'http', 'mailto'],
    });
    return this.postProcessLinks(clean);
  }

  extractPlainText(html: string): string {
    return sanitizeHtml(html, { allowedTags: [] }) as string;
  }

  computeWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  computeReadingMinutes(wordCount: number): number {
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  private postProcessLinks(html: string): string {
    return html.replace(/<a\s+href="([^"]+)"/g, (_match, href: string) => {
      const isExternal = href.startsWith('http') && !this.isAllowedDomain(new URL(href).host);
      if (isExternal) {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"`;
      }
      if (href.startsWith('http')) {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer"`;
      }
      return `<a href="${href}"`;
    });
  }

  private isAllowedDomain(host: string): boolean {
    try {
      return this.allowedDomains.some((d) => d === host || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }
}
