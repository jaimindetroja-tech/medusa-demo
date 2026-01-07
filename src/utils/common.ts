export const delay = async (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export const slugify = (text: string) =>
    text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
