import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import os
from typing import Optional, Tuple
import mimetypes
from datetime import datetime
import uuid

# Cloudflare R2 Configuration
# Note: Set these environment variables or update with your credentials
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "4dffa334f65a3162f5bd6372de42759f")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "e964b7b6440321b7b729dd89206f217a")  # Set via environment variable
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "9bc4aed8e61ce289fb9b3be5f034c2d8f8993843b67904fbb0102ff45b23df97")  # Set via environment variable
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "ai-extension")
R2_ENDPOINT_URL = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "https://cdn.aradhangini.com")

class R2Storage:
    """Cloudflare R2 Storage Manager"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'  # R2 uses 'auto' for region
        )
        self.bucket_name = R2_BUCKET_NAME
    
    def upload_file(
        self, 
        file_bytes: bytes, 
        filename: str, 
        content_type: Optional[str] = None,
        folder: str = "uploads"
    ) -> Tuple[bool, str, str]:
        """
        Upload a file to R2
        
        Args:
            file_bytes: File content as bytes
            filename: Original filename
            content_type: MIME type (auto-detected if None)
            folder: Folder path in bucket (e.g., 'uploads', 'snapshots')
        
        Returns:
            Tuple of (success: bool, file_url: str, error_message: str)
        """
        try:
            # Generate unique filename
            file_ext = os.path.splitext(filename)[1]
            unique_filename = f"{uuid.uuid4().hex}{file_ext}"
            object_key = f"{folder}/{datetime.now().strftime('%Y/%m/%d')}/{unique_filename}"
            
            # Auto-detect content type if not provided
            if not content_type:
                content_type, _ = mimetypes.guess_type(filename)
                if not content_type:
                    content_type = 'application/octet-stream'
            
            # Upload to R2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file_bytes,
                ContentType=content_type,
                Metadata={
                    'original_filename': filename,
                    'uploaded_at': datetime.utcnow().isoformat()
                }
            )
            
            # Construct public URL
            file_url = f"{R2_PUBLIC_URL}/{object_key}"
            
            return True, file_url, ""
        
        except ClientError as e:
            error_msg = f"R2 upload failed: {str(e)}"
            print(error_msg)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"Unexpected error during upload: {str(e)}"
            print(error_msg)
            return False, "", error_msg
    
    def delete_file(self, file_url: str) -> Tuple[bool, str]:
        """
        Delete a file from R2
        
        Args:
            file_url: Full URL of the file to delete
        
        Returns:
            Tuple of (success: bool, error_message: str)
        """
        try:
            # Extract object key from URL
            object_key = file_url.replace(f"{R2_PUBLIC_URL}/", "")
            
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key
            )
            
            return True, ""
        
        except ClientError as e:
            error_msg = f"R2 delete failed: {str(e)}"
            print(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"Unexpected error during delete: {str(e)}"
            print(error_msg)
            return False, error_msg
    
    def generate_presigned_url(self, file_url: str, expiry: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for temporary access
        
        Args:
            file_url: Full URL of the file
            expiry: URL expiry time in seconds (default: 1 hour)
        
        Returns:
            Presigned URL or None if failed
        """
        try:
            # Extract object key from URL
            object_key = file_url.replace(f"{R2_PUBLIC_URL}/", "")
            
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_key
                },
                ExpiresIn=expiry
            )
            
            return presigned_url
        
        except ClientError as e:
            print(f"Failed to generate presigned URL: {str(e)}")
            return None

# Singleton instance
r2_storage = R2Storage()
