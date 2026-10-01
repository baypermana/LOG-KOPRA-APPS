export const generateTag = () => `TAG-${Math.floor(1000+Math.random()*9000)}-${Date.now().toString().slice(-4)}`
