import { FinalSynthesisSections } from '@/types';

export function parseFinalSynthesis(rawText: string): FinalSynthesisSections {
  const sections: FinalSynthesisSections = { rawText };

  const extractSection = (headingRegex: RegExp, nextHeadingRegex: RegExp): string => {
    const match = headingRegex.exec(rawText);
    if (!match) return '';

    const startIndex = match.index + match[0].length;
    const rest = rawText.slice(startIndex);
    const nextMatch = nextHeadingRegex.exec(rest);

    const content = nextMatch ? rest.slice(0, nextMatch.index) : rest;
    return content.trim();
  };

  sections.directAnswer = extractSection(
    /###\s*Direct Answer/i,
    /###\s*(Key Reasoning|Points of Agreement|Important Disagreements|Best Conclusion|Practical Recommendation|Remaining Uncertainty)/i
  );

  sections.keyReasoning = extractSection(
    /###\s*Key Reasoning/i,
    /###\s*(Points of Agreement|Important Disagreements|Best Conclusion|Practical Recommendation|Remaining Uncertainty)/i
  );

  sections.pointsOfAgreement = extractSection(
    /###\s*Points of Agreement/i,
    /###\s*(Important Disagreements|Best Conclusion|Practical Recommendation|Remaining Uncertainty)/i
  );

  sections.importantDisagreements = extractSection(
    /###\s*Important Disagreements/i,
    /###\s*(Best Conclusion|Practical Recommendation|Remaining Uncertainty)/i
  );

  sections.bestConclusion = extractSection(
    /###\s*Best Conclusion/i,
    /###\s*(Practical Recommendation|Remaining Uncertainty)/i
  );

  sections.practicalRecommendation = extractSection(
    /###\s*Practical Recommendation/i,
    /###\s*Remaining Uncertainty/i
  );

  sections.remainingUncertainty = extractSection(
    /###\s*Remaining Uncertainty/i,
    /$/
  );

  return sections;
}
