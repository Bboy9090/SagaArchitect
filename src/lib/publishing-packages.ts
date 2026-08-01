import type { PublishingMetadata, WritingDocument } from './types';
import { orderedWritingDocuments } from './writing-documents';
import { publishableWritingDocuments } from './publishing-preflight';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const encoder = new TextEncoder();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function storedZip(files: Array<[string, string]>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x800, true);
    localView.setUint32(14, checksum, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true); localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length); localParts.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x800, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, nameBytes.length, true); centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46); centralParts.push(central); offset += local.length;
  }
  const central = joinBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, central.length, true); endView.setUint32(16, offset, true);
  return joinBytes([...localParts, central, end]);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function paragraphs(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split(/\n{2,}/u).map(item => item.trim()).filter(Boolean);
}

function headingLevel(document: WritingDocument): 1 | 2 | 3 {
  return document.parent_id ? 3 : document.kind === 'manuscript' ? 1 : 2;
}

function sectionClass(document: WritingDocument): string {
  if (['title_page', 'copyright', 'dedication', 'epigraph', 'foreword', 'preface'].includes(document.kind)) return 'front-matter';
  if (['acknowledgements', 'about_author', 'appendix'].includes(document.kind)) return 'back-matter';
  return 'body-matter';
}

export function createDocxPackage(title: string, documents: WritingDocument[], metadata: PublishingMetadata = {}): Uint8Array {
  const body = orderedWritingDocuments(publishableWritingDocuments(documents)).flatMap(document => {
    const heading = `<w:p><w:pPr><w:pStyle w:val="Heading${headingLevel(document)}"/></w:pPr><w:r><w:t>${escapeXml(document.title)}</w:t></w:r></w:p>`;
    const content = paragraphs(document.content).map(paragraph => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`);
    return [heading, ...content];
  }).join('');
  return storedZip([
    ['[Content_Types].xml', `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(metadata.author || 'Phoenix Creator Studio')}</dc:creator>${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ''}${metadata.language ? `<dc:language>${escapeXml(metadata.language)}</dc:language>` : ''}${metadata.rights ? `<dc:rights>${escapeXml(metadata.rights)}</dc:rights>` : ''}</cp:coreProperties>`],
    ['word/document.xml', `${XML_HEADER}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`],
    ['word/styles.xml', `${XML_HEADER}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>${[1, 2, 3].map(level => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:rPr><w:b/><w:sz w:val="${34 - level * 4}"/></w:rPr></w:style>`).join('')}</w:styles>`],
  ]);
}

export function createEpubPackage(title: string, documents: WritingDocument[], metadata: PublishingMetadata = {}): Uint8Array {
  const ordered = orderedWritingDocuments(publishableWritingDocuments(documents));
  const manuscript = ordered.map((document, index) => {
    const level = headingLevel(document);
    return `<section id="document-${index + 1}" class="${sectionClass(document)}"><h${level}>${escapeXml(document.title)}</h${level}>${paragraphs(document.content).map(paragraph => `<p>${escapeXml(paragraph)}</p>`).join('')}</section>`;
  }).join('');
  const nav = ordered.map((document, index) => `<li><a href="manuscript.xhtml#document-${index + 1}">${escapeXml(document.title)}</a></li>`).join('');
  return storedZip([
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', `${XML_HEADER}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ['EPUB/package.opf', `${XML_HEADER}<package version="3.0" unique-identifier="book-id" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${escapeXml(metadata.isbn ? `urn:isbn:${metadata.isbn.replace(/[\s-]/g, '')}` : `urn:uuid:${crypto.randomUUID()}`)}</dc:identifier><dc:title>${escapeXml(title)}</dc:title><dc:language>${escapeXml(metadata.language || 'en')}</dc:language><dc:creator>${escapeXml(metadata.author || 'Phoenix Creator Studio')}</dc:creator>${metadata.publisher ? `<dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>` : ''}${metadata.description ? `<dc:description>${escapeXml(metadata.description)}</dc:description>` : ''}${metadata.rights ? `<dc:rights>${escapeXml(metadata.rights)}</dc:rights>` : ''}<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="manuscript" href="manuscript.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="manuscript"/></spine></package>`],
    ['EPUB/nav.xhtml', `${XML_HEADER}<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol>${nav}</ol></nav></body></html>`],
    ['EPUB/manuscript.xhtml', `${XML_HEADER}<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(title)}</title><style>body{font-family:serif;line-height:1.6;margin:5%}h1,h2,h3{page-break-after:avoid}section{break-before:page}</style></head><body><h1>${escapeXml(title)}</h1>${manuscript}</body></html>`],
  ]);
}
