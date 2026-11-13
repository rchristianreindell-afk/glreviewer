# SIYENSYA-bilidad 2 — Interactive DOST Reviewer

A local, browser-based study reviewer built from the 82-page PDF supplied for this task.

## Start here

1. Download and extract the ZIP file.
2. Open the extracted `dost_reviewer` folder.
3. Double-click `index.html` and open it in a recent version of Chrome or Microsoft Edge.
4. Use the left navigation to select a section. Your practice answers, bookmarks, and exam history are saved in that browser when local storage is available.

No Python installation, package installation, API key, or internet connection is required for the core reviewer. Keep the folder structure intact: `index.html`, `app.js`, `question-data.js`, `styles.css`, the `assets` folder, and the source PDF are used together.

## Included question bank

| Section | Questions |
|---|---:|
| Verbal Reasoning | 10 |
| Non-Verbal Reasoning | 20 |
| English | 43 |
| Science | 60 |
| Mathematics | 40 |
| Mechanical-Technical | 30 |
| **Total** | **203** |

Every numbered question has an answer-key entry mapped from the source answer-key section. The reviewer includes source-page images for all 50 question pages (PDF pages 9–58) and includes the original 82-page PDF for reference.

## Main features

- Practice mode with answer selection, submission, retry, previous/next navigation, bookmarks, hints, and feedback.
- Source rationalizations displayed when they are present in the PDF.
- Timed exam mode with configurable section scope and duration, randomized order, question flags, hidden answers until submission, and a results review.
- Mistake notebook for questions last answered incorrectly and bookmarked questions.
- Local progress dashboard and section-level accuracy analytics.
- Original PDF page image beside each practice question; diagrams can be enlarged or rotated. Exam mode includes a collapsible source-page image so figure-based questions remain answerable.
- Supplemental interactive models: 3D spatial rotation cube, connected gears, linear-function graph, wave explorer, and simple Biology/Chemistry/Earth Science visual aids.

## Source and accuracy notes

- The uploaded DOST-SEI `SIYENSYA-bilidad 2` PDF is the authority for original question wording, source page figures, and keyed answers.
- The extraction audit accounts for 203 numbered questions and 203 answer-key entries.
- The PDF contains written rationalizations for 124 items. The remaining 79 items have an answer-key letter but no written rationalization in the source. Those gaps are called out in the reviewer rather than filled with invented source explanations.
- Some diagrams and mathematical notation do not extract cleanly as text. The original page image and included source PDF are the reference for those items; the page images are not AI-redrawn replacements.
- Where the source does not explain each distractor individually, the reviewer says so. It does not pretend the PDF contains explanations that are absent.

## Current limitations

This is a working first release, not the entire expanded platform described in the master prompt. The visual models are section- or concept-level learning aids; they are not custom-built animations for every individual question, and the 3D cube is a generic spatial trainer rather than a reconstruction of each original puzzle. The mechanical laboratory focuses on gear relationships; it does not yet contain dedicated custom simulations for every pulley, lever, belt, and electrical item.

The Study Companion is an offline helper, not a connected generative AI tutor. It can display source rationalizations and explain when a rationale is missing, but it does not generate verified new explanations. Progress is stored in the current browser only; there is no account system, cloud synchronization, or cross-device history.

## Copyright and use

The original source PDF is reproduced in this local study package solely as the material supplied for this review task. The source itself carries a DOST-SEI copyright notice. Retain its attribution and do not treat this package as authorization for commercial redistribution.
