import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Builds and downloads the candidate's interview performance report as a PDF.
// Extracted verbatim from Step3Report so the component stays presentational.
export function downloadInterviewReportPdf(report) {
  const {
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    questionWiseScore = [],
  } = report || {};

  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let currentY = 25;

  // ================= TITLE =================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(34, 197, 94);
  doc.text("AI Interview Performance Report", pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 5;

  // underline
  doc.setDrawColor(34, 197, 94);
  doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

  currentY += 15;

  // ================= FINAL SCORE BOX =================
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, "F");

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Final Score: ${finalScore}/10`,
    pageWidth / 2,
    currentY + 12,
    { align: "center" }
  );

  currentY += 30;

  // ================= SKILLS BOX =================
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(margin, currentY, contentWidth, 30, 4, 4, "F");

  doc.setFontSize(12);

  doc.text(`Confidence: ${confidence}`, margin + 10, currentY + 10);
  doc.text(`Communication: ${communication}`, margin + 10, currentY + 18);
  doc.text(`Correctness: ${correctness}`, margin + 10, currentY + 26);

  currentY += 45;

  // ================= ADVICE =================
  let advice = "";

  if (finalScore >= 8) {
    advice =
      "Excellent performance. Maintain confidence and structure. Continue refining clarity and supporting answers with strong real-world examples.";
  } else if (finalScore >= 5) {
    advice =
      "Good foundation shown. Improve clarity and structure. Practice delivering concise, confident answers with stronger supporting examples.";
  } else {
    advice =
      "Significant improvement required. Focus on structured thinking, clarity, and confident delivery. Practice answering aloud regularly.";
  }

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220);
  doc.roundedRect(margin, currentY, contentWidth, 35, 4, 4);

  doc.setFont("helvetica", "bold");
  doc.text("Professional Advice", margin + 10, currentY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const splitAdvice = doc.splitTextToSize(advice, contentWidth - 20);
  doc.text(splitAdvice, margin + 10, currentY + 20);

  currentY += 50;

  // ================= QUESTION TABLE =================
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["#", "Question", "Score", "Feedback"]],
    body: questionWiseScore.map((q, i) => [
      `${i + 1}`,
      q.question,
      `${q.score}/10`,
      q.feedback,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 5,
      valign: "top",
    },
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: 255,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" }, // index
      1: { cellWidth: 55 }, // question
      2: { cellWidth: 20, halign: "center" }, // score
      3: { cellWidth: "auto" }, // feedback
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  });

  doc.save("AI_Interview_Report.pdf");
}
