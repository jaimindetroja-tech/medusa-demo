import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text, toast, Toaster } from "@medusajs/ui"
import { useState } from "react"
import { ArrowPath } from "@medusajs/icons"

const ProductSyncWidget = () => {
    const [isLoading, setIsLoading] = useState(false)

    const handleSync = async () => {
        setIsLoading(true)
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
            setIsLoading(false)
        }
    }

    return (
        <Container className="mb-4">
            <div className="flex items-center justify-between">
                <div>
                    <Heading level="h2">Product Sync</Heading>
                    <Text className="text-ui-fg-subtle">
                        Manually trigger synchronization with external product source.
                    </Text>
                </div>
                <Button
                    variant="secondary"
                    onClick={handleSync}
                    isLoading={isLoading}
                >
                    {!isLoading && <ArrowPath />}
                    Sync Products
                </Button>
            </div>
            <Toaster />
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "product.list.before",
})

export default ProductSyncWidget
