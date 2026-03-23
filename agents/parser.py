import os
import base64
import tempfile
import fitz
import requests
from bs4 import BeautifulSoup
from llama_parse import LlamaParse

def scrape_url(url):
    """Fetches and extracts readable text from a web URL."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()
            
        text = soup.get_text(separator=' ', strip=True)
        return text[:15000] # Limit to avoid massive token costs
    except Exception as e:
        print(f"URL Scraping Error: {e}")
        raise ValueError(f"Could not extract content from URL: {str(e)}")

def parse_document(base64_file, filename):
    """Uses LlamaCloud for text extraction and PyMuPDF to extract embedded images."""
    try:
        if "," in base64_file:
            header, encoded = base64_file.split(",", 1)
        else:
            encoded = base64_file
            
        file_bytes = base64.b64decode(encoded)
        ext = os.path.splitext(filename)[1] or ".pdf"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name

        try:
            # 1. Extract Text via LlamaParse
            parser = LlamaParse(
                api_key=os.getenv("LLAMA_CLOUD_API_KEY"),
                result_type="markdown",
                verbose=True
            )
            documents = parser.load_data(temp_path)
            extracted_text = "\n\n".join([doc.text for doc in documents])
            
            # 2. Extract Images via PyMuPDF (If it is a PDF)
            extracted_images = []
            if ext.lower() == ".pdf":
                pdf_doc = fitz.open(temp_path)
                for page_num in range(len(pdf_doc)):
                    page = pdf_doc.load_page(page_num)
                    image_list = page.get_images(full=True)
                    
                    for img_index, img in enumerate(image_list):
                        xref = img[0]
                        base_image = pdf_doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        image_ext = base_image["ext"]
                        
                        # Convert to base64 data URI format expected by the pipeline
                        b64 = base64.b64encode(image_bytes).decode("utf-8")
                        extracted_images.append({
                            "name": f"{filename}_Page{page_num+1}_Img{img_index+1}.{image_ext}",
                            "type": f"image/{image_ext}",
                            "data": f"data:image/{image_ext};base64,{b64}"
                        })
                pdf_doc.close()

            return extracted_text, extracted_images
            
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
    except Exception as e:
            print(f"Document Parsing Error: {e}")   
            raise ValueError(f"Failed to parse document: {str(e)}")