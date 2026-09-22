# Phase 18 — ML Preparation (TypeScript-First)

> **Tier 3.** Define interfaces in TypeScript now. No Python, no model training, no ML infrastructure until Phase 19 — and even then, only if deterministic rules demonstrably fall short.

---

## Goal

Make the application ML-ready by defining TypeScript interfaces for classifiers today, so that a future ML implementation (Python microservice or in-process model) can be swapped in without changing any calling code.

---

## Design Principle: Interfaces Now, ML Later

```
Today (Tier 1–2):
  AccountClassifier → RuleBasedClassifier → deterministic result

Phase 19 (only if needed):
  AccountClassifier → MLClassifier via HTTP → model-based result

Phase 19 (in-process alternative):
  AccountClassifier → ONNXClassifier → local model inference (Node.js)
```

---

## Features

### 1. TypeScript Classification Interfaces

```typescript
// discovery/classifier.ts

export interface ClassificationResult {
  isAccountEmail: boolean;
  confidence: number;              // 0.0 – 1.0
  predictedCategory: string;       // "Social", "Finance", etc.
  detectionMethod: 'catalog' | 'regex' | 'generic' | 'ml_v1';
  modelVersion: string | null;     // null for rule-based
}

export interface AccountClassifier {
  classify(features: EmailFeatures): Promise<ClassificationResult>;
}

export interface CategoryClassifier {
  categorize(serviceName: string, domain: string): Promise<ClassificationResult>;
}

export interface EmailFeatures {
  senderEmail: string;
  senderDomain: string;
  subject: string;
  senderName?: string;
}
```

### 2. Rule-Based Implementations (Already Exist — Wrap Them)

```typescript
// discovery/rule-based-classifier.ts

export class RuleBasedAccountClassifier implements AccountClassifier {
  async classify(features: EmailFeatures): Promise<ClassificationResult> {
    const result = runPatternMatching(features);   // Existing Phase 4 logic
    return {
      isAccountEmail: result.matched,
      confidence: result.confidence,
      predictedCategory: result.category,
      detectionMethod: result.method,
      modelVersion: null,   // No model for rule-based
    };
  }
}

export class RuleBasedCategoryClassifier implements CategoryClassifier {
  async categorize(serviceName: string, domain: string): Promise<ClassificationResult> {
    const category = lookupCatalogCategory(domain) ?? 'Other';
    return {
      isAccountEmail: true,
      confidence: category !== 'Other' ? 1.0 : 0.6,
      predictedCategory: category,
      detectionMethod: 'catalog',
      modelVersion: null,
    };
  }
}
```

### 3. Confidence Label Mapping (Standardize Now)

```typescript
export function toConfidenceLabel(score: number): 'confirmed' | 'likely' | 'candidate' {
  if (score >= 0.85) return 'confirmed';
  if (score >= 0.70) return 'likely';
  return 'candidate';
}
```

### 4. Candidate Dataset Collection (MongoDB)

Log uncertain classifications passively to build future training data:

```typescript
// models/ml-candidate.schema.ts
const MLCandidateSchema = new Schema({
  candidateType:   { type: String, required: true },  // 'account_email' | 'category'
  features:        { type: Schema.Types.Mixed, required: true },
  predictedLabel:  { type: String },
  confidence:      { type: Number },
  detectionMethod: { type: String },
  modelVersion:    { type: String },
  userConfirmed:   { type: Boolean },                  // null = no feedback yet
  confirmedAt:     { type: Date },
}, { timestamps: true });

MLCandidateSchema.index({ candidateType: 1, userConfirmed: 1 });
```

Write to `mlCandidates` when:
- Classification confidence < 0.85
- User confirms or dismisses an uncertain account

### 5. Feature Flag

```
ENABLE_ML=false   (default)
```

When `ENABLE_ML=true`:
- Dependency-inject `MLAccountClassifier` instead of `RuleBasedAccountClassifier`
- Zero caller code changes

### 6. Python Microservice Option (Phase 19 Only)

If ML is introduced in Phase 19, the recommended approach is a **lightweight Python FastAPI microservice** that exposes a single HTTP endpoint:

```
POST http://ml-service:8001/classify
Body: { features: { ... } }
Response: { isAccountEmail, confidence, predictedCategory, modelVersion }
```

The `MLAccountClassifier` in TypeScript calls this endpoint:

```typescript
export class MLAccountClassifier implements AccountClassifier {
  async classify(features: EmailFeatures): Promise<ClassificationResult> {
    const res = await fetch(`${process.env.ML_SERVICE_URL}/classify`, {
      method: 'POST',
      body: JSON.stringify({ features }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  }
}
```

The calling code never changes regardless of whether the classifier is rule-based, ONNX in-process, or a Python HTTP service.

---

## Database Changes

`mlCandidates` collection (add only when starting Phase 18):
```typescript
export const MLCandidate = mongoose.model('MLCandidate', MLCandidateSchema);
```

---

## API Changes

None visible to end users in Phase 18. Optional admin endpoint:
```
GET /api/v1/admin/ml/candidates?confirmed=false&limit=100
```

---

## Background Jobs

None in Phase 18 (Prep). Phase 19 may add a `ml` queue for batch inference.

---

## What Is Intentionally NOT Implemented

```
❌ Python in Phase 18 (TypeScript interfaces only)
❌ Actual ML model training
❌ Model registry / MLflow
❌ Feature store
❌ A/B testing infrastructure
❌ Drift detection
❌ Training pipeline / data pipeline
❌ Any external ML API (OpenAI, Vertex AI) for account detection
❌ ML-weighted risk scoring (100% deterministic until Phase 19 proves value)
```

---

## Cost / Complexity Considerations

- Defining interfaces costs ~2 days and saves weeks of refactoring when ML is introduced.
- `mlCandidates` logging is passive — no performance impact.
- The Python microservice option (Phase 19) is completely isolated — main app never needs Python installed.
- Candidate data is collected from day one, making future training possible with real labeled data.

---

## Acceptance Criteria

- [ ] `AccountClassifier` and `CategoryClassifier` TypeScript interfaces are defined.
- [ ] `RuleBasedAccountClassifier` implements `AccountClassifier`.
- [ ] Discovery pipeline uses classifiers through the interface (not direct function calls).
- [ ] Confidence levels map correctly: ≥0.85 = confirmed, ≥0.70 = likely, <0.70 = candidate.
- [ ] `mlCandidates` collection logs all classifications with confidence < 0.85.
- [ ] User confirm/dismiss updates `userConfirmed` on the candidate document.
- [ ] `ENABLE_ML=false` by default — no ML code invoked without the flag.
- [ ] Swapping to an `MLAccountClassifier` requires zero changes to the discovery pipeline.
