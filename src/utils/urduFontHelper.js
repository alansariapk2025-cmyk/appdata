import { jsPDF } from "jspdf";

// Register Noto Nastaliq Urdu font for jsPDF
const registerUrduFont = () => {
  if (!jsPDF.API.fonts["NotoNastaliqUrdu-Bold"]) {
    // Using a simpler approach - we'll render Urdu text as part of the HTML and convert to PDF
    // This ensures proper Unicode support for Urdu
  }
};

export default registerUrduFont;
