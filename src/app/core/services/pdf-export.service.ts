import { Injectable } from '@angular/core';
import { CV_LAYOUT } from '../constants/cv-layout.constants';

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  async downloadElementAsPdf(element: HTMLElement, fileName: string): Promise<void> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter',
    });

    const pageWidth = CV_LAYOUT.page.widthIn;
    const pageHeight = CV_LAYOUT.page.heightIn;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, pageHeight);
    }

    const safeName = fileName.replace(/\.pdf$/i, '').replace(/[^\w\-]+/g, '_');
    pdf.save(`${safeName}.pdf`);
  }
}
