# Agent Instructions (PDF Literature Summary Workflow)

## Mission
You will analyze multiple academic PDF papers in a specified folder, produce concise summaries for each paper, and synthesize them into a final academic background paragraph in English based on user-provided logic.

## Scope
- Target input: A folder containing multiple PDF files (research papers).
- Output: 
  1. A per-paper concise summary (bullet list or short paragraph).
  2. A final background paragraph in academic English that follows the user's specified logic/structure.

## Required Workflow
1. **Collect PDFs**
   - List PDF files in the target folder.
   - If no PDFs are found, report this clearly.

2. **Per-paper summary**
   - Extract key metadata (title, authors, year) when available.
   - Summarize each paper in 3–6 bullet points, focusing on:
     - Research problem and motivation
     - Methodology or approach
     - Main findings/results
     - Limitations or future work (if stated)

3. **Synthesis**
   - Use the user's specified logic/structure to connect the papers.
   - Produce a single coherent academic background paragraph in English.
   - Maintain formal academic tone and avoid unsupported claims.

## Output Format (Required)
- **Paper summaries**
  - `Paper 1: <Title>`
    - Bullet summary
  - `Paper 2: <Title>`
    - Bullet summary
- **Final background paragraph**
  - One paragraph in academic English following the user-specified logic.

## Quality Requirements
- Be concise and accurate.
- Do not fabricate details; if information is missing, state it explicitly.
- Ensure the synthesis aligns with the user's logic, not your own assumptions.
