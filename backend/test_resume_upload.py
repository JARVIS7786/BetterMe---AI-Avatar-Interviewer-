"""Test resume upload to debug the error"""
import sys
from rag_engine import rag_engine

# Test with an existing resume file
file_path = "uploads/10979182-71d9-4174-ae2b-865fda877a6e_ResumE.pdf"
user_id = "test-debug-user"

print("Extracting text from resume...")
try:
    extracted_text = rag_engine.extract_text_from_resume(file_path)
    print(f"Extracted {len(extracted_text)} characters")
    print(f"Preview: {extracted_text[:200]}...")
except Exception as e:
    print(f"ERROR extracting text: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nAnalyzing resume...")
try:
    analysis = rag_engine.analyze_resume(extracted_text, user_id)
    print(f"Analysis successful!")
    print(f"Skills: {analysis.get('skills', [])}")
    print(f"Experience: {analysis.get('experience_years', 0)} years")
    print(f"Summary: {analysis.get('summary', '')[:200]}...")
except Exception as e:
    print(f"ERROR analyzing resume: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nSUCCESS!")
