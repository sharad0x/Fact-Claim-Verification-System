import os
import base64
import tempfile
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
    """Uses LlamaCloud (LlamaParse) to extract text from PDFs/Docs."""
    try:
        # Decode the base64 string from the frontend
        if "," in base64_file:
            header, encoded = base64_file.split(",", 1)
        else:
            encoded = base64_file
            
        file_bytes = base64.b64decode(encoded)
        
        # Determine extension and create a temporary file for LlamaParse
        ext = os.path.splitext(filename)[1] or ".pdf"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name

        try:
            # Initialize LlamaParse
            parser = LlamaParse(
                api_key=os.getenv("LLAMA_CLOUD_API_KEY"),
                result_type="markdown",
                verbose=True
            )
            
            # Parse the document
            documents = parser.load_data(temp_path)
            
            # Combine all pages into one string
            extracted_text = "\n\n".join([doc.text for doc in documents])
            return extracted_text
            
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        print(f"Document Parsing Error: {e}")
        raise ValueError(f"Failed to parse document using LlamaCloud: {str(e)}")