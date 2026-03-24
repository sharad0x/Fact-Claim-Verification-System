# Use official Python runtime as a parent image
FROM python:3.10-slim

# Install system dependencies (ffmpeg is REQUIRED for pydub audio processing)
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port Render uses
EXPOSE 10000

# Run gunicorn with a 120-second timeout (AI processing takes time!)
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--timeout", "120", "app:app"]