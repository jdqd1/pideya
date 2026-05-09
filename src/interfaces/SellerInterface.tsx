import AdminInterface from "./AdminInterface"
import type { AdminInterfaceProps } from "./AdminInterface"

export type SellerInterfaceProps = Omit<AdminInterfaceProps, "isAdmin" | "isSeller">

export default function SellerInterface(props: SellerInterfaceProps) {
  return <AdminInterface {...props} isAdmin={false} isSeller={true} />
}
