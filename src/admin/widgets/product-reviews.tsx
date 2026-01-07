import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Table, StatusBadge, IconButton, usePrompt, Toaster, toast } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Trash } from "@medusajs/icons"

type Review = {
    id: string
    rating: number
    comment: string
    customer_name: string
    status: "pending" | "approved" | "rejected"
    created_at: string
}

const ProductReviewsWidget = ({ data: product }: { data: any }) => {
    const [reviews, setReviews] = useState<Review[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const prompt = usePrompt()

    const fetchReviews = async () => {
        try {
            const response = await fetch(`/admin/reviews?product_id=${product.id}`)
            const data = await response.json()
            setReviews(data.reviews || [])
        } catch (error) {
            console.error("Failed to fetch reviews", error)
            toast.error("Error", { description: "Failed to fetch reviews" })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (product?.id) {
            fetchReviews()
        }
    }, [product?.id])

    const handleStatusUpdate = async (id: string, action: "approve" | "reject") => {
        try {
            const response = await fetch(`/admin/reviews/${id}/${action}`, {
                method: "POST",
            })

            if (!response.ok) throw new Error("Failed to update status")

            toast.success("Success", { description: `Review ${action}d successfully` })
            fetchReviews()
        } catch (error) {
            toast.error("Error", { description: "Failed to update review status" })
        }
    }

    const handleDelete = async (id: string) => {
        const res = await prompt({
            title: "Are you sure?",
            description: "This cannot be undone.",
            confirmText: "Yes, delete",
            cancelText: "Cancel",
        })

        if (!res) return

        try {
            const response = await fetch(`/admin/reviews/${id}`, {
                method: "DELETE",
            })

            if (!response.ok) throw new Error("Failed to delete")

            toast.success("Success", { description: "Review deleted successfully" })
            fetchReviews()
        } catch (error) {
            toast.error("Error", { description: "Failed to delete review" })
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved":
                return "green"
            case "rejected":
                return "red"
            case "pending":
                return "orange"
            default:
                return "grey"
        }
    }

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-x-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                    <span
                        key={index}
                        className={`${index < rating ? "text-ui-fg-interactive" : "text-ui-fg-muted"
                            }`}
                    >
                        ★
                    </span>
                ))}
                <span className="ml-2 text-ui-fg-subtle text-xs">({rating}/5)</span>
            </div>
        )
    }

    return (
        <Container className="p-0 overflow-hidden">
            <div className="p-6 pb-4 border-b border-ui-border-base flex items-center justify-between">
                <Heading level="h2">Product Reviews</Heading>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-8 text-ui-fg-subtle">
                    <span className="animate-pulse">Loading reviews...</span>
                </div>
            ) : reviews.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-ui-fg-subtle">
                    No reviews yet.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table className="w-full">
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell className="hidden md:table-cell pl-6">Date</Table.HeaderCell>
                                <Table.HeaderCell>Customer</Table.HeaderCell>
                                <Table.HeaderCell>Rating</Table.HeaderCell>
                                <Table.HeaderCell className="hidden lg:table-cell">Comment</Table.HeaderCell>
                                <Table.HeaderCell>Status</Table.HeaderCell>
                                <Table.HeaderCell className="pr-6 text-right">Actions</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {reviews.map((review) => (
                                <Table.Row key={review.id} className="group">
                                    <Table.Cell className="hidden md:table-cell pl-6 text-ui-fg-subtle whitespace-nowrap">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </Table.Cell>
                                    <Table.Cell className="font-medium whitespace-nowrap">
                                        {review.customer_name}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="min-w-[100px]">{renderStars(review.rating)}</div>
                                    </Table.Cell>
                                    <Table.Cell className="hidden lg:table-cell max-w-[300px] truncate text-ui-fg-subtle" title={review.comment}>
                                        {review.comment}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge color={getStatusColor(review.status)}>
                                            {review.status}
                                        </StatusBadge>
                                    </Table.Cell>
                                    <Table.Cell className="pr-6 text-right">
                                        <div className="flex items-center justify-end gap-x-2">
                                            {review.status === "pending" && (
                                                <>
                                                    <IconButton
                                                        size="small"
                                                        variant="transparent"
                                                        className="hover:bg-ui-bg-base-hover"
                                                        onClick={() => handleStatusUpdate(review.id, "approve")}
                                                    >
                                                        <CheckCircle className="text-ui-fg-interactive" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        variant="transparent"
                                                        className="hover:bg-ui-bg-base-hover"
                                                        onClick={() => handleStatusUpdate(review.id, "reject")}
                                                    >
                                                        <XCircle className="text-ui-fg-error" />
                                                    </IconButton>
                                                </>
                                            )}
                                            <IconButton
                                                size="small"
                                                variant="transparent"
                                                className="hover:bg-ui-bg-base-hover"
                                                onClick={() => handleDelete(review.id)}
                                            >
                                                <Trash className="text-ui-fg-subtle hover:text-ui-fg-error" />
                                            </IconButton>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            )}
            <Toaster />
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "product.details.after",
})

export default ProductReviewsWidget
