import { jsPDF } from 'jspdf';
import {
  getArtisticFilter,
  renderBlobWithArtisticFilter,
  type ArtisticFilterId,
} from './artisticFilters';

export interface PdfAlbumPhotoInput {
  id: string;
  scenarioTitle: string;
  categoryName: string;
  promptUsed?: string;
  createdAt: string;
  url: string;
  folderName?: string | null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler imagem para o álbum PDF.'));
    reader.readAsDataURL(blob);
  });
}

function getImageNaturalSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 896,
        height: img.naturalHeight || 1200,
      });
    img.onerror = () => reject(new Error('Falha ao medir dimensões da imagem.'));
    img.src = dataUrl;
  });
}

function sanitizePdfSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'album'
  );
}

export async function exportAlbumToPdfBlob(params: {
  albumTitle: string;
  photos: PdfAlbumPhotoInput[];
  appliedFilters: Record<string, ArtisticFilterId>;
  fetchImageBlob: (url: string) => Promise<Blob>;
}): Promise<{ blob: Blob; filename: string }> {
  const { albumTitle, photos, appliedFilters, fetchImageBlob } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const exportDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Capa do álbum
  doc.setFillColor(12, 12, 18);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(124, 58, 237);
  doc.rect(20, 32, 24, 2.2, 'F');

  doc.setTextColor(168, 85, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PROMPTFACE · ÁLBUM DE FOTOGRAFIAS', 20, 44);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const titleLines = doc.splitTextToSize(albumTitle, pageWidth - 40) as string[];
  doc.text(titleLines, 20, 62);

  doc.setTextColor(161, 161, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const subtitleY = 62 + titleLines.length * 11 + 6;
  doc.text(
    `${photos.length} ${photos.length === 1 ? 'fotografia selecionada' : 'fotografias organizadas'} · Exportado em ${exportDate}`,
    20,
    subtitleY
  );

  doc.setDrawColor(50, 50, 68);
  doc.line(20, pageHeight - 36, pageWidth - 20, pageHeight - 36);
  doc.setFontSize(9.5);
  doc.setTextColor(161, 161, 170);
  doc.text(
    'Gerado a partir da sua galeria privada PromptFace · Conteúdo pessoal protegido por LGPD.',
    20,
    pageHeight - 26
  );

  // Uma página organizada por fotografia
  for (let i = 0; i < photos.length; i++) {
    const item = photos[i];
    const filterId = appliedFilters[item.id] ?? 'original';
    const filterInfo = getArtisticFilter(filterId);

    doc.addPage('a4', 'portrait');
    doc.setFillColor(16, 16, 24);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setTextColor(168, 85, 247);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(
      `FOTO ${String(i + 1).padStart(2, '0')} DE ${String(photos.length).padStart(2, '0')} · ${item.categoryName.toUpperCase()}`,
      18,
      18
    );

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text(item.scenarioTitle, 18, 27);

    const rawBlob = await fetchImageBlob(item.url);
    const { blob: renderedBlob, ext } = await renderBlobWithArtisticFilter(
      rawBlob,
      filterId,
      'original'
    );
    const dataUrl = await blobToDataUrl(renderedBlob);
    const dims = await getImageNaturalSize(dataUrl);

    const maxImgW = pageWidth - 36;
    const maxImgH = 175;
    const scale = Math.min(maxImgW / dims.width, maxImgH / dims.height);
    const drawW = dims.width * scale;
    const drawH = dims.height * scale;
    const drawX = (pageWidth - drawW) / 2;
    const drawY = 34;

    const imageType = ext === 'png' ? 'PNG' : 'JPEG';
    doc.addImage(dataUrl, imageType, drawX, drawY, drawW, drawH, undefined, 'FAST');

    const metaY = drawY + drawH + 10;
    doc.setDrawColor(48, 48, 64);
    doc.line(18, metaY - 4, pageWidth - 18, metaY - 4);

    doc.setTextColor(161, 161, 170);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const createdFormatted = new Date(item.createdAt).toLocaleDateString('pt-BR');
    const folderLabel = item.folderName ? `Pasta: ${item.folderName}` : 'Sem pasta';
    doc.text(
      `${createdFormatted} · Filtro: ${filterInfo.label} · ${folderLabel}`,
      18,
      metaY + 2
    );

    const promptText = (item.promptUsed || '').trim() || item.scenarioTitle;
    doc.setTextColor(228, 228, 231);
    doc.setFontSize(10);
    const promptLines = doc.splitTextToSize(
      `Prompt utilizado: ${promptText}`,
      pageWidth - 36
    ) as string[];
    doc.text(promptLines.slice(0, 6), 18, metaY + 10);
  }

  const blob = doc.output('blob');
  const slug = sanitizePdfSlug(albumTitle);
  return {
    blob,
    filename: `promptface-album-${slug}.pdf`,
  };
}
