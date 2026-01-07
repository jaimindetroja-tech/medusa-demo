import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text, toast, Toaster, IconButton } from "@medusajs/ui"
import { useState } from "react"
import { ArrowPath, ArrowDownTray } from "@medusajs/icons"

const ProductSyncWidget = () => {
    const [isSyncing, setIsSyncing] = useState(false)
    const [isExporting, setIsExporting] = useState(false)

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const res = await fetch("/admin/sync-products", {
                method: "POST"
            })

            if (!res.ok) throw new Error("Failed to start sync")

            toast.success("Sync Complete", {
                description: "Products synchronized. Refreshing page..."
            })

            // Reload to show changes
            setTimeout(() => {
                window.location.reload()
            }, 1000)
        } catch (error) {
            toast.error("Error", {
                description: "Failed to trigger product sync."
            })
            console.error(error)
            setIsSyncing(false)
        }
    }

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const response = await fetch("/admin/products/export")

            if (!response.ok) throw new Error("Failed to export")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `products_export_${Date.now()}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("Success", { description: "Export downloaded successfully" })
        } catch (error) {
            toast.error("Error", { description: "Failed to export products" })
            console.error(error)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <Container className="mb-4">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level="h2">Product Actions</Heading>
                    <Text className="text-ui-fg-subtle">
                        Manage product synchronization and data export.
                    </Text>
                </div>
                <div className="flex items-center gap-x-2">
                    <Button
                        variant="secondary"
                        onClick={handleExport}
                        isLoading={isExporting}
                    >
                        {!isExporting && <ArrowDownTray />}
                        Export CSV
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleSync}
                        isLoading={isSyncing}
                    >
                        {!isSyncing && <ArrowPath />}
                        Sync Products
                    </Button>
                </div>
            </div>
            <Toaster />
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "product.list.before",
})

export default ProductSyncWidget
