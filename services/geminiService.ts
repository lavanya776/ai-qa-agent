
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_TEXT } from '../constants';
import { GeneratedTestCaseData, SuggestedModule, TestType, ALL_TEST_TYPES, TestCase, TestStatus, AutoExecutionResult } from '../types';

// Ensure API_KEY is available. In a Replit environment, this should be set in Secrets.
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY environment variable not set. Gemini API calls will fail.");
  // alert("Gemini API Key is not configured. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

/**
 * A generic wrapper for API calls that includes retry logic for rate limits.
 * This function attempts to parse the Gemini error to distinguish between
 * a retryable rate limit and a non-retryable hard quota limit.
 * @param apiCall The asynchronous function that makes the Gemini API call.
 * @returns The result of the API call.
 */
const withRateLimitRetry = async <T,>(apiCall: () => Promise<T>): Promise<T> => {
    const maxRetries = 2; // Total 3 attempts (1 initial + 2 retries)
    const initialDelay = 5000; // 5 seconds for the first retry

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error: unknown) {
            let isRetryable = false;

            // Try to find the core error message and status from various possible error structures
            let coreError: { message?: string; status?: string } | null = null;
            if (typeof error === 'object' && error !== null) {
                // Case 1: The error object has a nested `error` property, e.g., { error: { ... } }
                if ('error' in error && typeof (error as any).error === 'object' && (error as any).error) {
                    coreError = (error as any).error;
                } 
                // Case 2: The error is an object with a `message` property that is a JSON string
                else if ('message' in error && typeof (error as any).message === 'string') {
                    try {
                        const parsed = JSON.parse((error as any).message);
                        if (parsed.error && typeof parsed.error === 'object') {
                            coreError = parsed.error;
                        }
                    } catch (e) { /* Not JSON */ }
                }
            }

            if (coreError) {
                // We have a structured Gemini error, let's analyze it
                const isResourceExhausted = coreError.status === 'RESOURCE_EXHAUSTED';
                const isQuotaError = !!coreError.message?.toLowerCase().includes('quota');
                
                // Only retry if it's a rate limit (resource exhausted) but NOT a quota error.
                if (isResourceExhausted && !isQuotaError) {
                    isRetryable = true;
                }
            } else if (error instanceof Error) {
                // Fallback for non-structured errors, matching on the raw message text
                const lowerMessage = error.message.toLowerCase();
                const isRateLimitError = lowerMessage.includes("resource_exhausted") || lowerMessage.includes("429");
                const isQuotaError = lowerMessage.includes("quota");
                if (isRateLimitError && !isQuotaError) {
                    isRetryable = true;
                }
            }
            
            if (isRetryable && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.warn(`Rate limit hit. Retrying in ${delay / 1000}s... (Attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                // Not a retryable error (like a quota issue) or max retries reached.
                throw error; // Re-throw the original error to be handled by the calling function.
            }
        }
    }
    // This part should be unreachable if the loop always throws or returns.
    throw new Error("Retry logic failed unexpectedly.");
};


/**
 * Parses Gemini API errors to provide user-friendly messages.
 * @param error The error object caught from a Gemini API call.
 * @returns A string with a clear error message.
 */
const handleGeminiError = (error: unknown): string => {
  console.error("Gemini Service Error:", error);
  
  let coreError: { message?: string; status?: string } | null = null;
  let fallbackMessage = "An unknown error occurred in the Gemini Service.";

  // Robustly extract core error details from various possible structures
  if (typeof error === 'object' && error !== null) {
      if ('error' in error && typeof (error as any).error === 'object' && (error as any).error) {
          // Case 1: The error is the JSON payload itself, e.g. { error: { ... } }
          coreError = (error as any).error;
      } else if ('message' in error && typeof (error as any).message === 'string') {
          // Case 2: The error is an object (like an Error) with a `message` property.
          // This message could be plain text or a JSON string.
          fallbackMessage = (error as any).message;
          try {
              const parsed = JSON.parse(fallbackMessage);
              if (parsed.error && typeof parsed.error === 'object') {
                  coreError = parsed.error; // The message was JSON, we found the core error.
              }
          } catch (e) { /* Not JSON, we'll use the plain text `fallbackMessage` later */ }
      }
  } else if (error instanceof Error) {
      fallbackMessage = error.message;
  }
  
  // Priority 1: Generate a user-friendly message from the structured `coreError` if found.
  if (coreError && coreError.message) {
      const lowerNestedMessage = coreError.message.toLowerCase();
      
      // Specific check for QUOTA errors, which are not retryable.
      if (coreError.status === 'RESOURCE_EXHAUSTED' && lowerNestedMessage.includes('quota')) {
        return `API Quota Exceeded: ${coreError.message} This is a hard limit based on your plan. Please check your Google AI plan and billing details.`;
      }
      // Specific check for RATE LIMIT errors, which are retryable.
      if (coreError.status === 'RESOURCE_EXHAUSTED') {
           return `API Rate Limit Reached: ${coreError.message} The application is sending requests too quickly. Please wait a moment and try again.`;
      }
      if (lowerNestedMessage.includes("api key not valid")) {
          return `Invalid API Key: ${coreError.message}. Please check your API key is correct and enabled.`;
      }
      
      return `API Error: ${coreError.message}`;
  }

  // Priority 2: If no structured error, use the `fallbackMessage` with simple string matching.
  const lowerFallbackMessage = fallbackMessage.toLowerCase();
  if (lowerFallbackMessage.includes("quota")) {
    return "API quota exceeded. Please check your plan and billing details.";
  }
  if (lowerFallbackMessage.includes("resource_exhausted") || lowerFallbackMessage.includes("429")) {
    return "API rate limit reached. The app attempted to retry but was unsuccessful. Please wait a few minutes before trying again.";
  }
  if (lowerFallbackMessage.includes("api key not valid")) {
    return "Invalid API Key. Please ensure it is set correctly.";
  }
  if (lowerFallbackMessage.includes("safety")) {
    return "The request was blocked for safety reasons. Please adjust your input.";
  }
  
  return fallbackMessage; // Return the best message we found, or the initial default.
};


/**
 * Creates a short, uppercase abbreviation for a module name.
 * e.g., "User Login" -> "UL", "Payment" -> "PAYM"
 */
export const generateModuleAbbreviation = (moduleName: string): string => {
  if (!moduleName || moduleName.trim() === '') {
    return 'GEN'; // General
  }
  const words = moduleName.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length > 1) {
    // Take first letter of each word, max 4 letters
    return words.map(w => w[0]).join('').toUpperCase().substring(0, 4);
  } else {
    // Take first 4 letters of the single word
    return words[0].substring(0, 4).toUpperCase();
  }
};

/**
 * Generates a unique, sequential ID for a new test case within a specific module.
 * @param moduleName The name of the module.
 * @param allTestCases The array of all existing test cases.
 * @returns A new unique ID string (e.g., "UL_005").
 */
export const generateNextIdForModule = (moduleName: string, allTestCases: TestCase[]): string => {
    const moduleAbbr = generateModuleAbbreviation(moduleName);
    const testsForThisModule = allTestCases.filter(tc => tc.module === moduleName);
    let maxId = 0;
    testsForThisModule.forEach(tc => {
      if (tc.id.startsWith(moduleAbbr + '_')) {
        const match = tc.id.match(/_(\d+)$/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > maxId) maxId = num;
        }
      }
    });
    const newIdNumber = maxId + 1;
    return `${moduleAbbr}_${String(newIdNumber).padStart(3, '0')}`;
  };


const parseJsonFromMarkdown = <T,>(markdownString: string): T | null => {
  let jsonString = markdownString.trim();

  // 1. Look for a markdown code block. If found, use its content.
  const fenceRegex = /```(?:json)?\s*\n?(.*?)\n?\s*```/s;
  const match = jsonString.match(fenceRegex);
  if (match && match[1]) {
    jsonString = match[1].trim();
  }

  if (!jsonString) {
    console.error("Could not find any JSON content to parse from the AI response.");
    return null;
  }

  // Attempt to parse the original (or extracted) string first.
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    // If it fails, try fixing common issues like trailing commas.
    const fixedJsonString = jsonString.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(fixedJsonString) as T;
    } catch (finalError) {
      console.error("Final parsing attempt also failed. The AI response was not valid JSON.", {
        error: (finalError as Error).message,
        stringThatFailed: fixedJsonString,
      });
      return null;
    }
  }
};


export const discoverModulesWithAI = async (appUrl: string, appDescription: string, forceRefresh = false): Promise<{ modules: SuggestedModule[] }> => {
    if (!apiKey) throw new Error("API Key not configured for Gemini Service.");
    
    if (!appUrl && !appDescription) {
        throw new Error("Please provide an Application URL and/or Description in the Setup tab.");
    }
    
    const prompt = `
        You are a senior QA architect tasked with identifying the primary user-facing modules of a web application for test planning. 
        Your goal is to use your existing knowledge about the provided URL (if available) and the application description to create a single, comprehensive, and de-duplicated list of modules.

        **Instructions:**
        1. Analyze the application's context based on its URL and description.
        2. Synthesize this information to identify core features and user-facing modules. For example, think about common modules like 'User Login & Registration', 'Product Catalog', 'Shopping Cart', 'Admin Dashboard', etc.
        3. De-duplicate any overlapping modules, favoring more descriptive names where appropriate.
        4. For each final module, provide a concise name and a one-sentence description of its purpose.
        
        **Application Context:**
        - URL: "${appUrl || 'Not provided'}"
        - Description: "${appDescription || 'Not provided'}"

        **Output Requirements:**
        Return the output as a single, well-formed JSON array of objects, where each object has a "name" and a "description" key.
        The entire response body must be only the JSON array.

        Example format:
        [
          { "name": "User Login & Registration", "description": "Handles user authentication, including sign-in, sign-up, and password recovery." },
          { "name": "Product Catalog", "description": "Allows users to browse, search, and filter available products." },
          { "name": "Admin Dashboard", "description": "A private area for administrators to manage products, users, and orders." }
        ]
    `;

    const config: Record<string, any> = {
        responseMimeType: "application/json",
    };

    if (!forceRefresh) {
        config.seed = 42;
    }
    
    try {
        const apiCall = () => ai.models.generateContent({
            model: GEMINI_MODEL_TEXT,
            contents: prompt,
            config: config,
        });

        const response: GenerateContentResponse = await withRateLimitRetry(apiCall);

        const parsedResponse = parseJsonFromMarkdown<SuggestedModule[]>(response.text);

        if (!parsedResponse) {
            const finishReason = response.candidates?.[0]?.finishReason;
            if (finishReason === 'SAFETY') {
                 throw new Error("The request was blocked for safety reasons. Please adjust the app description.");
            }
            throw new Error("Failed to parse module suggestions from Gemini. The AI response was not structured as expected.");
        }
        
        return { modules: parsedResponse };

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};


export const analyzeModuleWithGemini = async (moduleName: string, moduleDescription: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key not configured for Gemini Service.");
  try {
    const prompt = `
      Analyze the following web application module and provide key insights for QA testing.
      Module Name: "${moduleName}"
      Module Description: "${moduleDescription}"

      Identify:
      1. Core functionalities and user flows.
      2. Key UI elements and interactions.
      3. Potential areas for complex logic or integrations.
      4. Common pitfalls or types of bugs to look for in such a module.

      Present the insights in a clear, concise, and actionable format for a QA engineer. Use markdown for formatting.
    `;
    
    const apiCall = () => ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: prompt,
      config: {
        seed: 42,
      },
    });
    
    const response: GenerateContentResponse = await withRateLimitRetry(apiCall);
    return response.text;
  } catch (error) {
    throw new Error(handleGeminiError(error));
  }
};

const generateMethodologyPrompt = (selectedTestTypes: TestType[]): string => {
  let methodologies = `Apply a combination of the following advanced QA methodologies based on the selected types:\n`;
  if (selectedTestTypes.includes(TestType.FUNCTIONAL)) {
    methodologies += `- **Functional (Black-Box) Testing:** Use Equivalence Partitioning & Boundary Value Analysis for input fields. Consider State Transition Testing for features with different states (e.g., logged in/out, draft/published).\n`;
  }
  if (selectedTestTypes.includes(TestType.UI_UX)) {
      methodologies += `- **UI/UX Testing:** Focus on visual design, layout consistency, and user experience flow. Check button placement, font size, contrast, alignment, and spacing.\n`;
  }
  if (selectedTestTypes.includes(TestType.NEGATIVE) || selectedTestTypes.includes(TestType.EDGE_CASE)) {
      methodologies += `- **Negative & Edge Case Testing:** Create scenarios where the system should handle errors gracefully (e.g., submitting incomplete forms, using invalid data formats, testing with zero/null values).\n`;
  }
  if (selectedTestTypes.includes(TestType.SECURITY)) {
      methodologies += `- **Security Testing:** Based on OWASP Top 10, suggest basic checks for Cross-Site Scripting (XSS) (e.g., entering "<script>alert(1)</script>" into fields) and improper error handling. Title these clearly (e.g., "Security Check: ...").\n`;
  }
  if (selectedTestTypes.includes(TestType.ACCESSIBILITY)) {
      methodologies += `- **Accessibility Testing:** Create tests for keyboard navigation (logical tab order), sufficient color contrast, and presence of alt text for images (conceptual).\n`;
  }
  if (selectedTestTypes.includes(TestType.RESPONSIVENESS)) {
      methodologies += `- **Responsiveness Testing:** Validate that the UI adapts correctly across various screen sizes. Generate tests for common viewports like Mobile (375px), Tablet (768px), and Desktop (1440px), including portrait/landscape orientations.\n`;
  }
  if (selectedTestTypes.includes(TestType.CROSS_BROWSER_COMPATIBILITY)) {
      methodologies += `- **Cross-Browser Compatibility Testing:** Ensure consistent behavior and rendering across latest versions of Chrome and Firefox.\n`;
  }
   if (selectedTestTypes.length === 0) {
    return `Generate a diverse set of general test cases, touching on functional, usability, and negative scenarios.`;
  }
  return methodologies;
}


export const generateTestCasesWithGemini = async (
  moduleName: string,
  moduleDescription: string,
  existingTestCount: number,
  totalTestsToGenerate: number,
  selectedTestTypes: TestType[]
): Promise<GeneratedTestCaseData[]> => {
  if (!apiKey) throw new Error("API Key not configured for Gemini Service.");
  
  const methodologyPrompt = generateMethodologyPrompt(selectedTestTypes);
  const testTypesString = selectedTestTypes.length > 0 ? selectedTestTypes.join('", "') : ALL_TEST_TYPES.join('", "');

  try {
    const prompt = `
      You are a Senior QA Engineer AI, specializing in creating comprehensive and professional test suites based on specific methodologies.
      Based on the provided web application module, generate approximately ${totalTestsToGenerate} diverse and high-quality test cases. Distribute the tests among the selected types. Do not generate overly simple tests (e.g., "Check if page loads").

      **Methodologies to Apply:**
      ${methodologyPrompt}

      **Context:**
      - Module Name: "${moduleName}"
      - Module Description: "${moduleDescription}"
      - Number of existing test cases for this module: ${existingTestCount}. Generate new, distinct test cases.

      **Crucial Rule:** All generated test cases MUST be strictly and directly related to the provided "Module Name". Do not create tests for other, related modules. For example, if the module is 'Shopping Cart', generate tests for adding/removing items or updating quantities inside the cart, but DO NOT generate tests for 'Product Search' or 'Checkout Process'. The test cases must focus exclusively on the functionality within the specified module.

      **Output Requirements:**
      For each generated test case, provide:
      - title: A concise summary of the test (max 15 words).
      - description: A slightly more detailed explanation of the test's purpose (max 30 words).
      - steps: An array of 3-5 strings, where each string is a clear, actionable step for the tester.
      - expectedResults: A clear description of what should happen if the test passes (max 25 words).
      - type: One of the following strings: "${testTypesString}". Choose the most relevant type from the list provided.

      **Output Format Example:**
      [
        {
          "title": "Add an item to the cart",
          "description": "Verify a user can successfully add a product to their shopping cart from the product detail page.",
          "steps": [
            "Navigate to a product detail page.",
            "Select a valid size and color.",
            "Click the 'Add to Cart' button."
          ],
          "expectedResults": "The item is added to the cart, and the cart's item count increases by one.",
          "type": "Functional"
        },
        {
          "title": "Attempt to add an item with an invalid quantity",
          "description": "Verify the system prevents adding an item to the cart with a negative or zero quantity.",
          "steps": [
            "Navigate to a product detail page.",
            "Enter '-1' into the quantity field.",
            "Click the 'Add to Cart' button."
          ],
          "expectedResults": "An error message is displayed, and the item is not added to the cart.",
          "type": "Negative"
        }
      ]

      Return the output as a single, well-formed JSON array of test case objects. Do not include any explanatory text, comments, or markdown formatting before or after the JSON array itself. The response must be only the JSON array.
    `;
    
    const apiCall = () => ai.models.generateContent({
      model: GEMINI_MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json", // Request JSON to simplify parsing
        seed: 42,
      }
    });

    const response: GenerateContentResponse = await withRateLimitRetry(apiCall);
    
    const textResponse = response.text;

    // Check for empty or blocked response first
    if (!textResponse || textResponse.trim() === '') {
        const finishReason = response.candidates?.[0]?.finishReason;
        let errorMessage = "Gemini returned an empty response.";
        if (finishReason === 'SAFETY') {
            errorMessage = "The request was blocked for safety reasons. Please try a different input.";
        } else if (finishReason) {
            errorMessage += ` Finish reason: ${finishReason}.`;
        }
        throw new Error(errorMessage);
    }

    const parsedResponse = parseJsonFromMarkdown<GeneratedTestCaseData[] | GeneratedTestCaseData>(textResponse);
    
    if (!parsedResponse) {
        throw new Error("Failed to parse test cases from Gemini response. The AI response format was invalid.");
    }

    const responseAsArray = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
    
    // Validate and normalize types
    const validTypes = selectedTestTypes.length > 0 ? selectedTestTypes : ALL_TEST_TYPES;
    return responseAsArray.map(tc => ({
        ...tc,
        type: validTypes.includes(tc.type as TestType) ? tc.type : validTypes[0] || TestType.FUNCTIONAL // Default if type is invalid
    }));

  } catch (error) {
    throw new Error(handleGeminiError(error));
  }
};

export const executeTestCaseWithGemini = async (testCase: TestCase, appDescription: string): Promise<AutoExecutionResult> => {
    if (!apiKey) throw new Error("API Key not configured for Gemini Service.");
    
    const prompt = `
        You are an expert AI QA automation engineer. Your task is to predict the outcome of a given test case for a web application without actually running it. You will be provided with the application's description and the details of a single test case.

        Analyze the test case in the context of the application. Predict if the test is likely to be 'Passed', 'Failed', or 'Blocked'. A 'Blocked' status should be used if the test cannot be performed due to a prerequisite failure (e.g., if a login test case is likely to fail, any test requiring login would be blocked).

        Return your response as a single, well-formed JSON object with two keys:
        1. "status": Your prediction, which must be one of "Passed", "Failed", or "Blocked".
        2. "actualResults": A concise, one-sentence explanation for your prediction. If the status is 'Failed' or 'Blocked', this explanation should clearly state the potential bug or reason.

        Do not include any other text, comments, or markdown formatting. The entire response must be only the JSON object.

        **Output Format Example:**
        {
          "status": "Failed",
          "actualResults": "The system is likely to handle invalid input incorrectly, leading to an application error instead of a user-friendly message."
        }

        **Application Context:**
        "${appDescription}"

        **Test Case to Analyze:**
        - Title: "${testCase.title}"
        - Description: "${testCase.description}"
        - Steps to Reproduce:
        ${testCase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
        - Expected Results: "${testCase.expectedResults}"
    `;

    try {
        const apiCall = () => ai.models.generateContent({
            model: GEMINI_MODEL_TEXT,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                seed: 42,
            }
        });

        const response: GenerateContentResponse = await withRateLimitRetry(apiCall);

        const textResponse = response.text;
        const parsedResponse = parseJsonFromMarkdown<AutoExecutionResult>(textResponse);
        
        if (!parsedResponse || !parsedResponse.status || !parsedResponse.actualResults) {
             throw new Error("Failed to parse auto-execution result from Gemini. The AI response was not valid JSON or was missing fields.");
        }

        // Validate status
        if (!Object.values(TestStatus).includes(parsedResponse.status)) {
            console.warn(`Gemini returned an invalid status '${parsedResponse.status}'. Defaulting to 'Blocked'.`);
            parsedResponse.status = TestStatus.BLOCKED;
            parsedResponse.actualResults = `AI returned invalid status. Original reason: ${parsedResponse.actualResults}`;
        }

        return parsedResponse;

    } catch (error) {
        throw new Error(handleGeminiError(error));
    }
};


// Helper function to convert CSV string to TestCase array
export const parseTestCasesFromCSV = (csvString: string): Omit<TestCase, 'id' | 'status'>[] => {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return []; // Header + at least one data row

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '')); // Normalize headers
  const requiredHeaders = ['title', 'description', 'steps(semicolonseparated)', 'expectedresults', 'type', 'module'];
  
  // Check for required headers robustly
  const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV missing required headers: ${missingHeaders.join(', ')}. Found: ${headers.join(', ')}`);
  }
  
  const titleIndex = headers.indexOf('title');
  const descriptionIndex = headers.indexOf('description');
  const stepsIndex = headers.indexOf('steps(semicolonseparated)');
  const expectedResultsIndex = headers.indexOf('expectedresults');
  const typeIndex = headers.indexOf('type');
  const moduleIndex = headers.indexOf('module');


  return lines.slice(1).map(line => {
    // More robust CSV parsing to handle commas within quoted fields
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i+1] === '"') { // Handle "" escape for quote within field
                 currentVal += '"';
                 i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(currentVal.trim());
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    values.push(currentVal.trim()); // Add the last value

    const entry: { [key: string]: string } = {};
    headers.forEach((header, index) => {
        entry[header] = values[index] || '';
    });
    
    return {
      title: entry.title || 'Untitled',
      description: entry.description || '',
      steps: (entry['steps(semicolonseparated)'] || '').split(';').map((s: string) => s.trim()).filter(s => s),
      expectedResults: entry.expectedresults || '',
      type: ALL_TEST_TYPES.includes(entry.type as TestType) ? entry.type as TestType : TestType.FUNCTIONAL,
      module: entry.module || 'Imported',
    };
  });
};


// Helper function to convert TestCase array to CSV string
export const convertTestCasesToCSV = (testCases: TestCase[]): string => {
  if (testCases.length === 0) return "";
  
  const headers = ['ID', 'Module', 'Title', 'Description', 'Steps (Semicolon Separated)', 'Expected Results', 'Type', 'Status', 'Actual Results'];
  const csvRows = [headers.join(',')];

  const formatCsvCell = (value: string | undefined): string => {
      const strValue = String(value || '');
      // Escape quotes by doubling them, and wrap in quotes if it contains comma, quote, or newline
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
  };

  testCases.forEach(tc => {
    const stepsString = tc.steps.join('; ');
    const row = [
      formatCsvCell(tc.id),
      formatCsvCell(tc.module),
      formatCsvCell(tc.title),
      formatCsvCell(tc.description),
      formatCsvCell(stepsString),
      formatCsvCell(tc.expectedResults),
      formatCsvCell(tc.type),
      formatCsvCell(tc.status),
      formatCsvCell(tc.actualResults)
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
};

// Helper function to convert failed/blocked TestCases to a Bug Report CSV
export const convertBugsToCSV = (testCases: TestCase[]): string => {
    if (testCases.length === 0) return "";

    const headers = ['Bug ID', 'Severity', 'Title', 'Module', 'Steps to Reproduce', 'Expected Behavior', 'Actual Behavior', 'Status'];
    const csvRows = [headers.join(',')];

    const formatCsvCell = (value: string | undefined): string => {
        const strValue = String(value || '');
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
    };
    
    const bugCases = testCases.filter(tc => tc.status === TestStatus.FAILED || tc.status === TestStatus.BLOCKED);

    bugCases.forEach(tc => {
        const stepsString = tc.steps.join('; ');
        const row = [
            formatCsvCell(tc.id),
            'Medium', // Severity - can be enhanced later
            formatCsvCell(tc.title),
            formatCsvCell(tc.module),
            formatCsvCell(stepsString),
            formatCsvCell(tc.expectedResults),
            formatCsvCell(tc.actualResults),
            formatCsvCell(tc.status),
        ];
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
};
