import Arweave from "arweave";
import { getTradingPosts } from "./get_trading_posts";
import { query } from "@utils/gql";
import { EdgeQueryResponse } from "types";
import sellQuery from "../queries/sell.gql";
import { maxInt } from "@utils/constants";
import moment from "moment";

export const volume = async (
  client: Arweave,
  token: string,
  exchangeContract: string,
  exchangeWallet: string
): Promise<{ volume: number[]; dates: string[] }> => {
  const posts = await getTradingPosts(client, exchangeContract, exchangeWallet);

  const orderTxs = (
    await query<EdgeQueryResponse>({
      query: sellQuery,
      variables: {
        recipients: posts,
        token,
        num: maxInt,
      },
    })
  ).data.transactions.edges;

  const orders: { amnt: number; timestamp: number }[] = [];
  orderTxs.map(({ node }) => {
    const inputTag = node.tags.find((tag) => tag.name === "Input");

    if (inputTag) {
      orders.push({
        amnt: JSON.parse(inputTag.value).qty,
        timestamp: node.block.timestamp,
      });
    }
  });

  const volume: number[] = [];
  const days: string[] = [];

  if (orders.length > 0) {
    let high = moment().add(1, "days").hours(0).minutes(0).seconds(0);

    while (high.unix() >= orders[orders.length - 1].timestamp) {
      const low = high.clone().subtract(1, "days");

      const sum = orders
        .filter(
          (order) =>
            order.timestamp <= high.unix() && order.timestamp >= low.unix()
        )
        .map((order) => order.amnt)
        .reduce((a, b) => a + b, 0);

      volume.push(sum);
      days.push(low.format("MMM DD"));

      high = low;
    }
  }

  return { volume: volume.reverse(), dates: days.reverse() };
};

export const arVolume = async (
  client: Arweave,
  exchangeContract: string,
  exchangeWallet: string
): Promise<{ volume: number[]; dates: string[] }> => {
  const posts = await getTradingPosts(client, exchangeContract, exchangeWallet);

  const orderTxs = (
    await query<EdgeQueryResponse>({
      query: `
        query($recipients: [String!], $num: Int) {
          transactions(
            recipients: $recipients
            tags: [
              { name: "Exchange", values: "Verto" }
              { name: "Type", values: "Buy" }
            ]
            first: $num
          ) {
            edges {
              node {
                quantity {
                  ar
                }
                block {
                  timestamp
                }
              }
            }
          }
        }      
      `,
      variables: {
        recipients: posts,
        num: maxInt,
      },
    })
  ).data.transactions.edges;

  const orders: { amnt: number; timestamp: number }[] = [];
  orderTxs.map(({ node }) => {
    orders.push({
      amnt: parseFloat(node.quantity.ar),
      timestamp: node.block.timestamp,
    });
  });

  const volume: number[] = [];
  const days: string[] = [];

  if (orders.length > 0) {
    let high = moment().add(1, "days").hours(0).minutes(0).seconds(0);

    while (high.unix() >= orders[orders.length - 1].timestamp) {
      const low = high.clone().subtract(1, "days");

      const sum = orders
        .filter(
          (order) =>
            order.timestamp <= high.unix() && order.timestamp >= low.unix()
        )
        .map((order) => order.amnt)
        .reduce((a, b) => a + b, 0);

      volume.push(sum);
      days.push(low.format("MMM DD"));

      high = low;
    }
  }

  return { volume: volume.reverse(), dates: days.reverse() };
};
