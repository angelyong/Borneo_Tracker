# AI Chat Six-Layer Answer

Stage 4B converts an internal `AIChatFactObject` into a deterministic `AIChatStructuredAnswer`. It does not call Gemini, does not retrieve levers, and does not expose the structured answer publicly.

The purpose is to make later fallback templates, Gemini phrasing, frontend structured rendering, and response validation consume the same explicit answer contract.

## Six-Layer Structure

The contract is defined in `supabase/functions/ai-chat/contracts.ts`.

- `conclusion`: the concise answer to the user question.
- `diagnosis`: deterministic weakest/strongest/supporting pillar facts.
- `gap`: target and gap when the Fact Object provides a verified compatible target and gap.
- `impact`: deterministic impact text only when already present in the Fact Object.
- `lever`: evidence-based intervention placeholder for later Stage 5 retrieval.
- `honesty`: warnings, limitations, disclosures, source limitations, and downgrade reasons.

Each layer has:

- `status`: `AVAILABLE`, `PARTIAL`, `UNAVAILABLE`, `BLOCKED`, or `NOT_APPLICABLE`.
- `heading`: deterministic English or Malay label.
- `text`: deterministic layer text.
- `codes`: machine-readable status/reason codes.
- `factReferences`: stable semantic references to Fact Object fields.
- `warnings`: layer-specific disclosures or limitations.

## Status Meanings

- `AVAILABLE`: layer has safe deterministic content.
- `PARTIAL`: layer has safe content but some requested operation or metadata is unavailable.
- `UNAVAILABLE`: layer cannot be populated from committed data.
- `BLOCKED`: comparability, ambiguity, or a safety rule blocks the layer.
- `NOT_APPLICABLE`: layer does not apply to this answer state.

## English and Malay

Stage 4B uses local templates only. Supported languages are `en` and `ms`.

English headings:

- Conclusion
- Diagnosis
- Gap
- Impact
- Recommended action
- Limitations

Malay headings:

- Kesimpulan
- Diagnosis
- Jurang
- Kesan
- Tindakan yang disyorkan
- Batasan

Unsupported language values fall back to English and add a `LANGUAGE_FALLBACK` warning.

## Blocked and Clarification Behavior

`REJECT` comparability results produce:

- `blocked: true`
- blocked conclusion
- blocked or not-applicable non-factual layers
- honesty warnings with blocking reasons first

`NEEDS_CLARIFICATION` produces:

- `blocked: true`
- `clarificationRequired: true`
- conclusion text from the ambiguity/comparability reason
- no guessed district, indicator, or comparison basis

`DOWNGRADE` preserves safe descriptive facts as `PARTIAL` and records the downgrade in honesty.

## Impact Limitation

Stage 4B does not simulate impact and does not estimate score changes.

When the Fact Object does not already contain deterministic impact text, the impact layer says:

`A quantified impact estimate is not available in the current dataset.`

Malay:

`Anggaran kesan berangka tidak tersedia dalam set data semasa.`

The Impact Simulator remains a later stage.

## Lever Limitation

Stage 5 lever retrieval is not implemented here. The lever layer therefore returns:

- `status: UNAVAILABLE` or `NOT_APPLICABLE`
- `leverIds: []`
- `requiresGeminiPhrasing: false`

It does not invent interventions, evidence, or recommendations.

## Source Handling

The structured answer carries Fact Object sources unchanged except for exact duplicate removal.

Rules:

- Do not invent sources.
- Do not add URLs to `summaryText`.
- Preserve `sourceFile` and `sourcePath`.
- Preserve missing publisher/title fields as missing.
- Do not perform web research.

## Numeric Integrity

The builder checks its own deterministic `summaryText`.

Allowed numeric tokens must appear in:

- `factObject.approvedNumericTokens`
- `factObject.approvedYearTokens`

URLs in summary text fail the check. Numbered headings are not used, which avoids accidental unapproved heading tokens.

This is not the full Stage 4E response validator; it only protects Stage 4B deterministic summary generation.

## Relationship to Stage 4A and Later Stages

Stage 4A builds the source-grounded Fact Object. Stage 4B transforms it into answer layers.

Later stages may:

- render deterministic fallback templates;
- pass approved structured facts to Gemini for phrasing;
- validate final responses;
- retrieve evidence-based levers;
- support frontend structured rendering.

Those later behaviors are intentionally not implemented in Stage 4B.

