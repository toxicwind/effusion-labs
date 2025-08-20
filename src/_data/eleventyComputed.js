const toArray = v => (Array.isArray(v) ? v : v ? [v] : []);

export default {
  tags: data => {
    const merged = [
      ...toArray(data.tags),
      ...toArray(data.analytic_lens),
      ...toArray(data.memory_ref),
      ...toArray(data.spark_type)
    ].filter(v => typeof v === 'string');
    return Array.from(new Set(merged)).sort();
  },
  categories: data => toArray(data.spark_type).filter(v => typeof v === 'string').sort()
};
