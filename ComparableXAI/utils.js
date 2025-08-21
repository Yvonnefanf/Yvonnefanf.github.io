function extract_features(row, domainId, numFlags, vm) {
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
                } else if(featName === 'Living Area (ksqft)' || featName === 'Distance to Downtown (miles)'){
                    const numVal = Number(val).toFixed(2);
                    featureVals.push(!isNaN(numVal) ? numVal : '');
                } else if(featName === 'Condition' || featName === 'Grade' || featName === 'Age (years)' ){
                    const numVal = Number(val).toFixed(0);
                    featureVals.push(!isNaN(numVal) ? numVal : '');
                } else if(featName === 'Hour of the Day'){
                    const numVal = Number(val).toFixed(0);
                    featureVals.push(!isNaN(numVal) ? numVal+':00' : '');
                } 
                else {
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

function processDomainMetadata(data, vm) {
    // Initialize arrays with correct size
    const domainCount = Math.max(...data.map(row => row.domainId)) + 1;

    vm.domain_list = new Array(domainCount);
    vm.unit_list = new Array(domainCount);
    vm.unit_list_header = new Array(domainCount);
    vm.warning = new Array(domainCount);
    vm.Labels = new Array(domainCount).fill(null).map(() => []);
    vm.Labels_Descriptions = new Array(domainCount).fill(null).map(() => []);

    data.forEach(row => {
        const idx = row.domainId;
        vm.domain_list[idx] = row.domainName;
        vm.unit_list[idx] = row.unit;

        vm.unit_list_header[idx] = row.unitHeader;
        vm.warning[idx] = row.warning;
        vm.Labels[idx] = [row.labelActual, row.labelPrediction, row.labelAdjusted];
        vm.Labels_Descriptions[idx] = [row.descriptionActual, row.descriptionPrediction, row.descriptionAdjusted];
    });
    console.log("finished process domain metadata")
}

function processFeatureMetadata(data, vm) {
    // Group by domainId
    const grouped = {};
    data.forEach(row => {
        if (!grouped[row.domainId]) {
            grouped[row.domainId] = [];
        }
        grouped[row.domainId].push(row);
    });

    // Initialize arrays
    const domainCount = Math.max(...Object.keys(grouped).map(Number)) + 1;
    vm.Features = new Array(domainCount).fill(null).map(() => []);
    vm.FeatureDescriptions = new Array(domainCount).fill(null).map(() => []);
    vm.numberical_feature = new Array(domainCount).fill(null).map(() => []);

    // Fill arrays
    Object.keys(grouped).forEach(domainId => {
        const domainIdx = Number(domainId);
        const features = grouped[domainId].sort((a, b) => a.featureId - b.featureId);

        vm.Features[domainIdx] = features.map(f => f.featureName);
        vm.FeatureDescriptions[domainIdx] = features.map(f => f.featureDescription);
        vm.numberical_feature[domainIdx] = features.map(f => f.isNumerical);

    });
    console.log("finished process feature metadata")
}

function processSubjects(data, vm) {
    // Group by domainId and instanceId
    const grouped = {};
    data.forEach(row => {
        if (!grouped[row.domainId]) {
            grouped[row.domainId] = {};
        }
        const domainId = row.domainId;
        const numFlags = vm.numberical_feature?.[domainId] || [];  // e.g. [true, false, ...]
        // Extract feature values
        const featureVals = extract_features(row, domainId, numFlags, vm)

        grouped[row.domainId][row.instanceId] = {
            feature_val: featureVals,
            pred: row.pred,
            actual: row.actual
        };
    });

    // Convert to array format
    const domainCount = Math.max(...Object.keys(grouped).map(Number)) + 1;
    vm.Targets = new Array(domainCount).fill(null).map(() => []);

    Object.keys(grouped).forEach(domainId => {
        const domainIdx = Number(domainId);
        const instances = grouped[domainId];
        const maxInstance = Math.max(...Object.keys(instances).map(Number));

        for (let i = 0; i <= maxInstance; i++) {
            vm.Targets[domainIdx][i] = instances[i] || null;
        }
    });
    console.log("finished process subject")
}


function processComparables(data, vm) {
    // Group by domainId, instanceId, and comparableId
    const grouped = {};

    data.forEach(row => {
        if (!grouped[row.domainId]) {
            grouped[row.domainId] = {};
        }
        if (!grouped[row.domainId][row.instanceId]) {
            grouped[row.domainId][row.instanceId] = {};
        }
        const domainId = row.domainId;
        const numFlags = vm.numberical_feature?.[domainId] || [];  // e.g. [true, false, ...]


        // Extract feature values and deltas

        const deltaX = [];
        const deltaY = [];
        const featureVals = extract_features(row, domainId, numFlags, vm)
        for (let i = 0; i < 6; i++) {
            const val = row[`feature${i}`];

            const dx = row[`delta_x${i}`];
            const dy = row[`delta_y${i}`];

            const dxVal = Number(dx);
            const dyVal = Number(dy);
            deltaX.push(!isNaN(dxVal) ? vm.domainIdx==1?dyVal.toFixed(3):dyVal.toFixed(2) : '0.0');
            deltaY.push(!isNaN(dyVal) ? vm.domainIdx==1?dyVal.toFixed(3):dyVal.toFixed(1) : '0.0');
        }

        // Parse adjusted_order and adjusted_price arrays
        let adjustedOrder = [];
        let adjustedPrice = [];

        // Handle adjusted_order - could be string, array, or null
        if (row.adjusted_order) {
            if (typeof row.adjusted_order === 'string') {
                adjustedOrder = row.adjusted_order.split(',').map(Number);
            } else if (Array.isArray(row.adjusted_order)) {
                adjustedOrder = row.adjusted_order.map(Number);
            } else {
                adjustedOrder = [row.adjusted_order].map(Number);
            }
        }

        // Handle adjusted_price - could be string, array, or null
        if (row.adjusted_price) {
            if (typeof row.adjusted_price === 'string') {
                adjustedPrice = row.adjusted_price.split(',').map(Number);
            } else if (Array.isArray(row.adjusted_price)) {
                adjustedPrice = row.adjusted_price.map(Number);
            } else {
                adjustedPrice = [row.adjusted_price].map(Number);
            }
        }

        grouped[row.domainId][row.instanceId][row.comparableId] = {
            id: row.comparableId,
            feature_val: featureVals,
            delta_x: deltaX,
            delta_y: deltaY,
            pred: row.pred,
            actual: row.actual,
            adjusted_step_number: row.adjusted_step_number,
            adjusted_order: adjustedOrder,
            adjusted_price: adjustedPrice,
            final_adjusted_price: adjustedPrice[adjustedPrice.length - 1] || 0
        };
    });

    // Convert to array format
    const domainCount = Math.max(...Object.keys(grouped).map(Number)) + 1;
    vm.Comparables = new Array(domainCount).fill(null).map(() => []);

    Object.keys(grouped).forEach(domainId => {
        const domainIdx = Number(domainId);
        const instances = grouped[domainId];

        Object.keys(instances).forEach(instanceId => {
            const instanceIdx = Number(instanceId);
            if (!vm.Comparables[domainIdx][instanceIdx]) {
                vm.Comparables[domainIdx][instanceIdx] = [];
            }

            const comparables = instances[instanceId];
            Object.keys(comparables).sort((a, b) => Number(a) - Number(b)).forEach(comparableId => {
                vm.Comparables[domainIdx][instanceIdx].push(comparables[comparableId]);
            });
        });
    });

    // Ensure all instances have a Comparables array, even if empty
    for (let domainIdx = 0; domainIdx < vm.Targets.length; domainIdx++) {
        const instances = vm.Targets[domainIdx] || [];
        for (let instanceIdx = 0; instanceIdx < instances.length; instanceIdx++) {
            if (!vm.Comparables[domainIdx]) {
                vm.Comparables[domainIdx] = [];
            }
            if (!vm.Comparables[domainIdx][instanceIdx]) {

                vm.Comparables[domainIdx][instanceIdx] = [];
            }
        }
    }
}


function processLinearAdjustments(data, vm) {
    // Group by domainId, instanceId, and comparableId
    const grouped = {};

    data.forEach(row => {
        if (!grouped[row.domainId]) {
            grouped[row.domainId] = {};
        }
        if (!grouped[row.domainId][row.instanceId]) {
            grouped[row.domainId][row.instanceId] = {};
        }
        const domainId = row.domainId;
        const numFlags = vm.numberical_feature?.[domainId] || [];  // e.g. [true, false, ...]
        // Extract feature values and deltas
        const deltaX = [];
        const deltaY = [];
        const featureVals = extract_features(row, domainId, numFlags, vm)
        for (let i = 0; i < 6; i++) {
            const val = row[`feature${i}`];

            const dx = row[`delta_x${i}`];
            const dy = row[`delta_y${i}`];

            const dxVal = Number(dx);
            const dyVal = Number(dy);
            deltaX.push(!isNaN(dxVal) ? dxVal.toFixed(3) : '0.0');
            deltaY.push(!isNaN(dyVal) ? vm.domainIdx==1?dyVal.toFixed(3):dyVal.toFixed(1) : '0.0');
        }
        grouped[row.domainId][row.instanceId][row.comparableId] = {
            id: row.comparableId,
            feature_val: featureVals,
            delta_x: deltaX,
            delta_y: deltaY,
            pred: vm.domainIdx == 1 ? Number(row.pred).toFixed(1) : Number(row.pred).toFixed(2),
            actual: Number(row.actual).toFixed(1),
            adjusted_price: Number(row.last_adjusted).toFixed(1)
        };
    });

    // Convert to array format
    const domainCount = Math.max(...Object.keys(grouped).map(Number)) + 1;
    vm.LinearAdjustments = new Array(domainCount).fill(null).map(() => []);

    Object.keys(grouped).forEach(domainId => {
        const domainIdx = Number(domainId);
        const instances = grouped[domainId];

        Object.keys(instances).forEach(instanceId => {
            const instanceIdx = Number(instanceId);
            if (!vm.LinearAdjustments[domainIdx][instanceIdx]) {
                vm.LinearAdjustments[domainIdx][instanceIdx] = [];
            }

            const comparables = instances[instanceId];
            Object.keys(comparables).sort((a, b) => Number(a) - Number(b)).forEach(comparableId => {
                vm.LinearAdjustments[domainIdx][instanceIdx].push(comparables[comparableId]);
            });
        });
    });

    // Ensure all instances have a linear_adjustments array, even if empty
    for (let domainIdx = 0; domainIdx < vm.Targets.length; domainIdx++) {
        const instances = vm.Targets[domainIdx] || [];
        for (let instanceIdx = 0; instanceIdx < instances.length; instanceIdx++) {
            if (!vm.LinearAdjustments[domainIdx]) {
                vm.LinearAdjustments[domainIdx] = [];
            }
            if (!vm.LinearAdjustments[domainIdx][instanceIdx]) {

                vm.LinearAdjustments[domainIdx][instanceIdx] = [];
            }
        }
    }

}

function processLinearReg(data, vm) {
    const grouped = {};
    data.forEach(row => {
        const d = Number(row.domainId);
        const i = Number(row.instanceId);
        if (!grouped[d]) grouped[d] = {};
        // Collect intercept and coefficients
        const coefs = [
            Number(row.coef_0), Number(row.coef_1), Number(row.coef_2),
            Number(row.coef_3), Number(row.coef_4), Number(row.coef_5)
        ];
        const features_val = Array.from({ length: 6 }, (_, k) =>
            Number(row[`feature${k}`])
        );
        grouped[d][i] = {
            intercept: vm.domainIdx == 1 ? Number(row.intercept.toFixed(2)) : Number(row.intercept.toFixed(1)),
            coefs,
            features_val,
            linear_pred: vm.domainIdx == 1 ? Number(row.linear_pred.toFixed(2)) : Number(row.intercept.toFixed(1))
        };
    });

    // Prepare the Linear_reg array with correct dimensions
    const maxDomain = Math.max(...data.map(r => Number(r.domainId)));
    vm.Linear_reg = Array.from({ length: maxDomain + 1 }, () => []);

    // Fill in the regression info, leaving gaps as null
    Object.entries(grouped).forEach(([domainKey, insts]) => {
        const d = Number(domainKey);
        const maxInst = Math.max(...Object.keys(insts).map(n => Number(n)));
        for (let idx = 0; idx <= maxInst; idx++) {
            vm.Linear_reg[d][idx] = insts[idx] || null;
        }
    });
}

