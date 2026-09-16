import { serverUrl } from "./serverUrl";

export const getUser = async (address: string) => {
    try {
        const response = await fetch(`${serverUrl}/user/address/${address}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
};

export const getChamaById = async (id: number) => {
    try {
        const response = await fetch(`${serverUrl}/chama/${id}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching chama:", error);
        return null;
    }
};

export const getPaymentsByUser = async (userId: number) => {
    try {
        const response = await fetch(`${serverUrl}/payments/user/${userId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching payments:", error);
        return [];
    }
};

export const makePayment = async (
    amount: bigint,
    txHash: string,
    chamaId: number,
    address: string,
    message: string,
    token: string
) => {
    try {
        const response = await fetch(`${serverUrl}/miniapp/register-payment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                amount: amount.toString(),
                txHash,
                chamaId,
                address,
                message,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error making payment:", error);
        return { success: false };
    }
};

export const getChamaPayouts = async (chamaId: number) => {
    try {
        const response = await fetch(`${serverUrl}/payouts/chama/${chamaId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching payouts:", error);
        return [];
    }
};
export const checkUser = getUser;

export const createUser = async (username: string, address: string, fid: number | null, isFarcaster: boolean) => {
    try {
        const response = await fetch(`${serverUrl}/auth/miniapp/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                walletAddress: address,
                fid,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error creating user:", error);
        return null;
    }
};

export const getChamaBySlug = async (slug: string, address?: string, token?: string) => {
    try {
        const url = address
            ? `${serverUrl}/chama/slug/${slug}?address=${address}`
            : `${serverUrl}/chama/slug/${slug}`;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching chama by slug:", error);
        return null;
    }
};

export const getChama = getChamaBySlug;


export const requestToJoinChama = async (address: string, chamaId: number, token: string) => {
    try {
        const response = await fetch(`${serverUrl}/miniapp/send-request?chamaId=${chamaId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ address }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error requesting to join chama:", error);
        return { success: false };
    }
};

export const addMemberToPublicChama = async (address: string, chamaId: number, amount: bigint, txHash: string, canJoin: boolean, token: string) => {
    try {
        const response = await fetch(`${serverUrl}/miniapp/join-chama`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                chamaId,
                amount: amount.toString(),
                txHash,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error adding member to public chama:", error);
        return { success: false };
    }
};

export const checkRequest = async (address: string, chamaId: number, token?: string) => {
    try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(`${serverUrl}/chama/check-request/${address}/${chamaId}`, {
            headers,
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error checking join request:", error);
        return null;
    }
};

export const addShownMemberToAll = async (userId: number) => {
    try {
        await fetch(`${serverUrl}/user/mark-payout-shown`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        });
    } catch (error) {
        console.error("Error marking payout shown:", error);
    }
};

export const checkPayoutModal = async (userId: number) => {
    try {
        const response = await fetch(`${serverUrl}/user/check-payout-modal/${userId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error checking payout modal:", error);
        return [];
    }
}


export const getPaymentsByUserToChama = async (userId: number, chamaId: number) => {
    try {
        const response = await fetch(`${serverUrl}/payments/user/${userId}/chama/${chamaId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching user payments to chama:", error);
        return [];
    }
};

export const createChama = async (chamaData: any, token: string) => {
    try {
        const response = await fetch(`${serverUrl}/miniapp/create-chama`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(chamaData),
        });
        return await response.json();
    } catch (error) {
        console.error("Error creating chama:", error);
        return { success: false };
    }
};

export const checkChama = async (name: string) => {
    try {
        const response = await fetch(`${serverUrl}/chama/check-name/${encodeURIComponent(name)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.exists;
    } catch (error) {
        console.error("Error checking chama name:", error);
        return false;
    }
};

export const getUserById = async (userId: number) => {
    try {
        const response = await fetch(`${serverUrl}/user/${userId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching user by id:", error);
        return null;
    }
}

export const getUserNotifications = async (userId: number) => {
    try {
        const response = await fetch(`${serverUrl}/user/notifications/${userId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching user notifications:", error);
        return [];
    }
}

export const getPendingRequests = async (userId: number) => {
    try {
        const response = await fetch(`${serverUrl}/chama/pending-requests/${userId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        return [];
    }
}

export const getRequestById = async (requestId: number) => {
    try {
        const response = await fetch(`${serverUrl}/chama/request/${requestId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Error fetching request by id:", error);
        return null;
    }
}

export const handleJoinRequest = async (requestId: number, decision: "approve" | "reject", userId: number, chamaId: number, canJoin: boolean) => {
    try {
        const response = await fetch(`${serverUrl}/miniapp/confirm-request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, decision, userId, chamaId, canJoin }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error handling join request:", error);
        return { success: false };
    }
}

