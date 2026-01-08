/**
 * Converts an array of objects to CSV format
 */
export function jsonToCsv(items: Record<string, any>[]): string {
    if (items.length === 0) {
        return "";
    }

    const headers = Object.keys(items[0]);
    const csvRows = [headers.join(",")];

    for (const item of items) {
        const values = headers.map(header => {
            const val = item[header];
            // Escape logic: wrap strings in quotes, escape existing quotes
            if (typeof val === "string") {
                const escaped = val.replace(/"/g, '""');
                return `"${escaped}"`;
            }
            return val;
        });
        csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
}
