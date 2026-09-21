declare module "web-push" {
  const webpush: {
    generateVAPIDKeys: () => { publicKey: string; privateKey: string };
    setVapidDetails: (mailto: string, publicKey: string, privateKey: string) => void;
    sendNotification: (
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
    ) => Promise<unknown>;
  };
  export default webpush;
}
