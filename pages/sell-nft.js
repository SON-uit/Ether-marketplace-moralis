import styles from "../styles/Home.module.css"
import { Form, useNotification, Button } from "web3uikit"
import { useMoralis, useWeb3Contract, useMoralisWeb3Api } from "react-moralis"
import { ethers } from "ethers"
import nftAbi from "../constants/BasicNft.json"
import nftMarketplaceAbi from "../constants/NftMarketplace.json"
import networkMapping from "../constants/networkMapping.json"
import { useEffect, useState } from "react"

export default function Home() {
    const { chainId, account, isWeb3Enabled } = useMoralis()
    console.log(account)
    const { account: fetchAccount } = useMoralisWeb3Api()
    const [nftOfUser, setNftofUser] = useState(null)
    const { Moralis, isInitialized, isInitializing } = useMoralis()
    const fetchNft = async () => {
        const data = await fetchAccount.getNFTs({
            chain: chainId,
        })
        const nftDetails = data.result.map((items) => {
            return {
                token_address: items.token_address,
                token_id: items.token_id,
                metadata: JSON.parse(items.metadata),
                price: 0.001,
            }
        })
        setNftofUser(nftDetails)
    }
    useEffect(() => {
        if (isInitialized) {
            fetchNft()
        }
    }, [isInitialized])
    const chainString = chainId ? parseInt(chainId).toString() : "31337"
    const marketplaceAddress = networkMapping[chainString].NftMarketplace[0]
    const dispatch = useNotification()
    const [proceeds, setProceeds] = useState("0")

    const { runContractFunction } = useWeb3Contract()

    //handler cancel Itesm
    // async function handleCancel() {
    //     console.log("Start cancel")
    //     const cancelOptions = {
    //         abi: nftMarketplaceAbi,
    //         contractAddress: marketplaceAddress,
    //         functionName: "cancelListing",
    //         params: {
    //             nftAddress: "0xbc3e653c145bb9359d3a7718326ddfb2a87c022c",
    //             tokenId: "1",
    //         },
    //     }
    //     console.log(cancelOptions)
    //     await runContractFunction({
    //         params: cancelOptions,
    //         onSuccess: (data) => {
    //             console.log(data)
    //         },
    //         onError: (error) => {
    //             console.log("error")
    //             console.log(error.message)
    //         },
    //     })
    // }
    // useEffect(() => {
    //     handleCancel()
    // }, [])
    async function approveAndList(data) {
        console.log("Approving...")
        const nftAddress = data.data[0].inputResult
        const tokenId = data.data[1].inputResult
        const price = ethers.utils.parseUnits(data.data[2].inputResult, "ether").toString()
        console.log(nftAddress, tokenId, price)
        const approveOptions = {
            abi: nftAbi,
            contractAddress: nftAddress,
            functionName: "approve",
            params: {
                to: marketplaceAddress,
                tokenId: tokenId,
            },
        }
        console.log(approveOptions)
        await runContractFunction({
            params: approveOptions,
            onSuccess: () => handleApproveSuccess(nftAddress, tokenId, price),
            onError: (error) => {
                console.log("herror")
                console.log(error)
            },
        })
    }

    async function handleApproveSuccess(nftAddress, tokenId, price) {
        console.log("Ok! Now time to list")
        const listOptions = {
            abi: nftMarketplaceAbi,
            contractAddress: marketplaceAddress,
            functionName: "listItem",
            params: {
                nftAddress: nftAddress,
                tokenId: tokenId,
                price: price,
            },
        }
        console.log(listOptions)
        await runContractFunction({
            params: listOptions,
            onSuccess: handleListSuccess,
            onError: (error) => {
                console.log("error")
                console.log(error.message)
            },
        })
    }

    async function handleListSuccess(tx) {
        await tx.wait(1)
        dispatch({
            type: "success",
            message: "NFT listing",
            title: "NFT listed",
            position: "topR",
        })
    }

    const handleWithdrawSuccess = async (tx) => {
        await tx.wait(1)
        dispatch({
            type: "success",
            message: "Withdrawing proceeds",
            position: "topR",
        })
    }

    async function setupUI() {
        const returnedProceeds = await runContractFunction({
            params: {
                abi: nftMarketplaceAbi,
                contractAddress: marketplaceAddress,
                functionName: "getProceeds",
                params: {
                    seller: account,
                },
            },
            onError: (error) => console.log(error),
        })
        if (returnedProceeds) {
            setProceeds(returnedProceeds.toString())
        }
    }

    useEffect(() => {
        if (isWeb3Enabled) {
            setupUI()
        }
    }, [proceeds, account, isWeb3Enabled, chainId])

    return (
        <div className={styles.container}>
            <Form
                onSubmit={approveAndList}
                data={[
                    {
                        name: "NFT Address",
                        type: "text",
                        inputWidth: "50%",
                        value: "",
                        key: "nftAddress",
                    },
                    {
                        name: "Token ID",
                        type: "number",
                        value: "",
                        key: "tokenId",
                    },
                    {
                        name: "Price (in ETH)",
                        type: "number",
                        value: "",
                        key: "price",
                    },
                ]}
                title="Sell your NFT!"
                id="Main Form"
            />
            <div className="grid grid-cols-2 gap-4">
                {nftOfUser &&
                    nftOfUser.map((nft, index) => (
                        <div key={index} className="flex flex-col">
                            <img
                                src={nft.metadata.image.replace(
                                    "ipfs://",
                                    "https://ipfs.io/ipfs/"
                                )}
                            />
                            <form>
                                <h4>Token Adress:</h4>
                                <input type="text" value={nft.token_address} />
                                <h4>Token Id:</h4>
                                <input type="text" value={nft.token_id} />
                                <h4>Price</h4>
                                <input type="text" value={nft.price} />
                                <button
                                    type="submit"
                                    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
                                >
                                    List
                                </button>
                            </form>
                        </div>
                    ))}
            </div>
            <div>Withdraw {proceeds} proceeds</div>
            {proceeds != "0" ? (
                <Button
                    onClick={() => {
                        runContractFunction({
                            params: {
                                abi: nftMarketplaceAbi,
                                contractAddress: marketplaceAddress,
                                functionName: "withdrawProceeds",
                                params: {},
                            },
                            onError: (error) => console.log(error),
                            onSuccess: handleWithdrawSuccess,
                        })
                    }}
                    text="Withdraw"
                    type="button"
                />
            ) : (
                <div>No proceeds detected</div>
            )}
        </div>
    )
}
