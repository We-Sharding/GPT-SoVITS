const ttsRequest = {
    text: text,
    speaker: speaker,
    language: language,
    text_split_method: "cut5",
    cut_punc: ",.;?!、，。？！；：…",  // Add custom punctuation for text splitting
    return_detailed_logs: true,
    batch_size: 5,
    streaming_mode: true,
    parallel_infer: true,
    temperature: 0.6,
    top_k: 5,
    top_p: 0.8
}; 