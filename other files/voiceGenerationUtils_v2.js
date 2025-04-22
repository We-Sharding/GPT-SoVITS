// voiceGenerationUtils_v2.js - Updated for GPT SoVITS api_v2.py
// IMPORTANT: Ensure your backend is running api_v2.py for this to work.

// Base configuration for GPT-SoVITS api_v2.py via proxy
const SOVITS_CONFIG_V2 = {
    baseUrl: '/tts-api', // Uses Vite's proxy targeting your api_v2.py instance
    endpoints: {
        tts: '/tts',
        setGptWeights: '/set_gpt_weights',     // Changed endpoint
        setSovitsWeights: '/set_sovits_weights', // Changed endpoint
    }
};

// Track last loaded models to avoid unnecessary switching
let lastGptModel = null;
let lastSovitsModel = null;

/**
 * Generates a single voice-over clip using api_v2.py.
 * @param {object} voiceConfig - Configuration for the voice model.
 * @param {string} voiceConfig.refAudioPath - Path to the reference audio file.
 * @param {string} voiceConfig.gptModel - Path to the GPT model file (.ckpt).
 * @param {string} voiceConfig.sovitsModel - Path to the SoVITS model file (.pth).
 * @param {string} [voiceConfig.promptText=""] - Optional prompt text for the reference audio.
 * @param {string} [voiceConfig.text_lang="en"] - Language of the text to synthesize (e.g., "zh", "en", "ja").
 * @param {string} [voiceConfig.prompt_lang="en"] - Language of the prompt text (e.g., "zh", "en", "ja").
 * @param {string} text - The text content to synthesize.
 * @param {string} characterType - Identifier for logging purposes.
 * @returns {Promise<string>} - Promise resolving to an object URL for the generated audio blob.
 */
export const generateSingleVoiceOver_v2 = async (voiceConfig, text, characterType) => {
    // Basic validation
    if (!voiceConfig?.refAudioPath || !voiceConfig?.gptModel || !voiceConfig?.sovitsModel || !text) {
        console.error('generateSingleVoiceOver_v2: Missing required parameters:', { voiceConfig, text });
        throw new Error('Missing required parameters for voice generation (v2)');
    }

    // Clean up the text
    const cleanedText = text.trim();
    console.log(`[v2] Generating audio for ${characterType} with text:`, cleanedText.substring(0, 100) + '...');

    try {
        // Only switch models if they're different from last time
        if (lastGptModel !== voiceConfig.gptModel || lastSovitsModel !== voiceConfig.sovitsModel) {
            console.log('[v2] Models changed, switching...');
            await switchModels_v2(voiceConfig.gptModel, voiceConfig.sovitsModel);
            lastGptModel = voiceConfig.gptModel;
            lastSovitsModel = voiceConfig.sovitsModel;
        } else {
            console.log('[v2] Using cached models - no need to switch');
        }

        // --- Prepare TTS Request Body for api_v2.py ---
        const ttsPayload = {
            // Core required parameters
            text: cleanedText,
            text_lang: voiceConfig.text_lang || 'en',       // Renamed parameter
            ref_audio_path: voiceConfig.refAudioPath,     // Renamed parameter
            prompt_lang: voiceConfig.prompt_lang || 'en',   // Renamed parameter

            // Optional & Tuning parameters (mapped from api.py where applicable)
            prompt_text: voiceConfig.promptText || "",
            top_k: voiceConfig.top_k ?? 25,                 // Keep if needed, default 5 in api_v2
            top_p: voiceConfig.top_p ?? 1,                   // Keep if needed, default 1 in api_v2
            temperature: voiceConfig.temperature ?? 0.6,     // Keep if needed, default 1 in api_v2
            speed_factor: voiceConfig.speed ?? 1,          // Renamed parameter (speed -> speed_factor)
            text_split_method: voiceConfig.text_split_method ?? "cut5", // Replaced cut_punc, "cut5" is a common default
            sample_steps: voiceConfig.sample_steps ?? 32,    // Keep for v3
            super_sampling: voiceConfig.super_sampling ?? true, // Controls audio super resolution (if_sr)
            fragment_interval: voiceConfig.fragment_interval ?? 0.15,  // Set to 0.15s to match successful WebUI run (API parameter name)
            // Performance-related parameters
           
            streaming_mode: voiceConfig.streaming_mode ?? false, // Set to true for streaming (perceived faster response)
            media_type: voiceConfig.media_type ?? "wav",   // Or "ogg", "aac", "raw"
            parallel_infer: voiceConfig.parallel_infer ?? false,  // Enabled for better performance
            repetition_penalty: voiceConfig.repetition_penalty ?? 1.35, // Default in api_v2
           // split_bucket: voiceConfig.split_bucket ?? true, // Enable data bucketing for better performance
            // Other optional parameters
            // seed: -1,
            // aux_ref_audio_paths: [],
            // batch_threshold: 0.75,
        };
        // ------------------------------------------------

        console.log('[v2] Sending TTS request with payload:', ttsPayload);

        // Send TTS request through proxy to api_v2.py /tts endpoint
        const response = await fetch(`${SOVITS_CONFIG_V2.baseUrl}${SOVITS_CONFIG_V2.endpoints.tts}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ttsPayload)
        });

        if (!response.ok) {
            let errorText = `HTTP error status: ${response.status}`;
            try {
                // Try to get more detailed error from backend JSON response
                const errorJson = await response.json();
                errorText = errorJson.message || errorJson.detail || JSON.stringify(errorJson);
            } catch (e) {
                // Fallback to plain text if response is not JSON
                errorText = await response.text();
            }
            console.error(`[v2] TTS generation failed: ${errorText}`);
            throw new Error(`TTS generation failed (v2): ${errorText}`);
        }

        const audioBlob = await response.blob();
        console.log('[v2] Audio generated successfully, blob size:', audioBlob.size);
        return URL.createObjectURL(audioBlob);

    } catch (error) {
        console.error(`[v2] Voice generation error for ${characterType}:`, error);
        // Re-throw the error so the caller can handle it
        throw error;
    }
};

// Queue for managing model switches to ensure they happen sequentially
let modelSwitchQueue_v2 = Promise.resolve();

/**
 * Switches the models on the api_v2.py backend using separate endpoints.
 * @param {string} gptModelPath - Path to the GPT model file (.ckpt).
 * @param {string} sovitsModelPath - Path to the SoVITS model file (.pth).
 * @returns {Promise<void>} - Promise that resolves when switching is complete.
 */
const switchModels_v2 = async (gptModelPath, sovitsModelPath) => {
    // Add the switching task to the end of the queue
    modelSwitchQueue_v2 = modelSwitchQueue_v2.then(async () => {
        try {
            console.log('[v2] Attempting to switch models to:', { gpt: gptModelPath, sovits: sovitsModelPath });

            // --- Switch GPT Model ---
            const gptUrl = `${SOVITS_CONFIG_V2.baseUrl}${SOVITS_CONFIG_V2.endpoints.setGptWeights}?weights_path=${encodeURIComponent(gptModelPath)}`;
            console.log('[v2] Setting GPT weights via GET:', gptUrl);
            const gptResponse = await fetch(gptUrl, { method: 'GET' });

            if (!gptResponse.ok) {
                const errorText = await gptResponse.text();
                console.error('[v2] Failed to switch GPT model:', errorText);
                throw new Error(`Failed to switch GPT model (v2): ${errorText}`);
            }
            console.log('[v2] GPT model switched successfully.');

            // --- Switch SoVITS Model ---
            const sovitsUrl = `${SOVITS_CONFIG_V2.baseUrl}${SOVITS_CONFIG_V2.endpoints.setSovitsWeights}?weights_path=${encodeURIComponent(sovitsModelPath)}`;
            console.log('[v2] Setting SoVITS weights via GET:', sovitsUrl);
            const sovitsResponse = await fetch(sovitsUrl, { method: 'GET' });

            if (!sovitsResponse.ok) {
                const errorText = await sovitsResponse.text();
                console.error('[v2] Failed to switch SoVITS model:', errorText);
                throw new Error(`Failed to switch SoVITS model (v2): ${errorText}`);
            }
            console.log('[v2] SoVITS model switched successfully.');
            console.log('[v2] Both models switched successfully.');

        } catch (error) {
            console.error('[v2] Model switching sequence error:', error);
            // Propagate the error to break the promise chain if needed
            throw error;
        }
    }).catch(error => {
        // Catch errors from the previous promise in the chain or the current operation
        console.error('[v2] Error during model switch in queue:', error);
        // Reset the queue head to allow subsequent attempts after an error
        modelSwitchQueue_v2 = Promise.resolve();
        // Re-throw the error to notify the caller of generateSingleVoiceOver_v2
        throw error;
    });

    // Return the promise representing this switch task in the queue
    return modelSwitchQueue_v2;
};


