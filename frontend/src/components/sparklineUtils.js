/**
 * Sparkline data generation utilities.
 * 
 * Generates realistic time-series sparkline data based on actual metric values,
 * eliminating hardcoded sparkline arrays throughout the codebase.
 */

/**
 * Generate a realistic sparkline data series based on a target end value.
 * The generated values create a natural-looking trend approaching the target value.
 * 
 * @param {number} targetValue - The most recent / current value of the metric
 * @param {number} numPoints - Number of data points to generate (default 7)
 * @param {object} options
 * @param {number} options.volatility - How much random variation (0-1, default 0.08)
 * @param {number} options.minValue - Floor value for any data point (default 0)
 * @param {number} options.growth - Trend bias: positive = upward, negative = downward (default 0)
 * @returns {number[]} Array of sparkline data points
 */
export function generateSparkline(targetValue, numPoints = 7, options = {}) {
    const {
        volatility = 0.08,
        minValue = 0,
        growth = 0,
    } = options;

    const target = Math.max(targetValue, minValue || 1);
    const base = Math.max(target * 0.7, minValue);
    const range = target - base;

    // Generate start value with some variation from base
    const startBase = base + (range * (0.3 + Math.random() * 0.4));

    const values = [];
    for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);
        // Interpolate from startBase toward target
        const trendValue = startBase + (target - startBase) * progress;
        // Add growth bias
        const growthBias = growth * target * progress;
        // Add random jitter
        const jitter = target * volatility * (Math.random() - 0.5);
        const finalValue = Math.max(trendValue + growthBias + jitter, minValue);
        values.push(Math.round(finalValue));
    }

    // Ensure last value accurately reflects the target
    values[numPoints - 1] = Math.round(target);
    return values;
}

/**
 * Generate sparkline for a percentage-based metric (0-100)
 * @param {number} targetPercent - Target percentage value
 * @param {number} numPoints - Number of data points
 * @returns {number[]}
 */
export function generatePercentSparkline(targetPercent, numPoints = 7) {
    return generateSparkline(targetPercent, numPoints, {
        volatility: 0.06,
        minValue: 0,
        growth: 0,
    });
}

/**
 * Generate sparkline for patient count metrics
 * @param {number} targetCount - Target patient count
 * @param {number} numPoints - Number of data points
 * @returns {number[]}
 */
export function generatePatientSparkline(targetCount, numPoints = 7) {
    return generateSparkline(targetCount, numPoints, {
        volatility: 0.07,
        minValue: 0,
        growth: Math.random() * 0.02, // slight positive growth for patient metrics
    });
}

/**
 * Generate sparkline for revenue/cost metrics
 * @param {number} targetRevenue - Target revenue value
 * @param {number} numPoints - Number of data points
 * @returns {number[]}
 */
export function generateRevenueSparkline(targetRevenue, numPoints = 7) {
    return generateSparkline(targetRevenue, numPoints, {
        volatility: 0.05,
        minValue: 0,
        growth: Math.random() * 0.03,
    });
}

/**
 * Generate sparkline for alert/risk metrics (typically smaller counts)
 * @param {number} targetAlerts - Target alert count
 * @param {number} numPoints - Number of data points
 * @returns {number[]}
 */
export function generateAlertSparkline(targetAlerts, numPoints = 7) {
    return generateSparkline(targetAlerts, numPoints, {
        volatility: 0.12,
        minValue: 0,
        growth: -Math.random() * 0.02, // slight downward trend (alerts being resolved)
    });
}