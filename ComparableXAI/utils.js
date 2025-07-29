function extract_features(row,domainId,numFlags,vm) {
    // Extract feature values
    const featureVals = [];
    for (let i = 0; i < 6; i++) {
        const val = row[`feature${i}`];
        if (val !== null && val !== undefined) {
            const featName = vm.Features[domainId][i];
            if (numFlags[i]) {
                if (featName === '# Bathroom') {
                    const raw = Number(val);
                    const whole = Math.floor(raw);
                    const frac = raw - whole;
                    let char = '';
                    if (Math.abs(frac - 0.25) < 1e-6) char = '\u00BC'; // ¼
                    else if (Math.abs(frac - 0.5) < 1e-6) char = '\u00BD'; // ½
                    else if (Math.abs(frac - 0.75) < 1e-6) char = '\u00BE'; // ¾

                    // “2¼” or “2” if no fraction
                    featureVals.push(char ? `${whole}${char}` : `${whole}`);
                } else {
                    // 其他数值一位小数
                    const numVal = Number(val).toFixed(1);
                    featureVals.push(!isNaN(numVal) ? numVal : '');
                }
            } else {

                // 类别型特征：转为字符串
                const raw = String(val);
                const featName = vm.Features[domainId][i];

                const mapForDomain = vm.categoryMappings[String(domainId)] || {};
                const labelMap = mapForDomain[featName] || {};

                featureVals.push(labelMap[raw] ?? raw);

            }
        } else {
            featureVals.push('');
        }
    }
    return featureVals
}