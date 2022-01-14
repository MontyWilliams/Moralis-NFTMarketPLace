const serverUrl = "https://5afgk9nae19l.usemoralis.com:2053/server";
const appId = "lhSPMJb08k6pB25ESY87s7VxvnNZobzHLWHbs8yj";
Moralis.start({ serverUrl, appId });

const TOKEN_CONTRACT_ADDRESS = "0x4159e7056192d775B44a8f69C78663747Ce0DE52";
const MARKETPLACE_CONTRACT_ADDRESS = "0xBA5272ABCa33AC6F7331eBEd0abd7fD75d231Ae1";

init = async () => {
  hideElement(userItemsSection);
  window.web3 = await Moralis.Web3.enable();
  window.tokenContract = new web3.eth.Contract(tokenContractAbi, TOKEN_CONTRACT_ADDRESS);
  window.marketplaceContract = new web3.eth.Contract(marketplaceContractAbi, MARKETPLACE_CONTRACT_ADDRESS);
  initUser();
  loadItems();

  const soldItemsQuery = new Moralis.Query('SoldItems');
  const soldItemsSubscription = await soldItemsQuery.subscribe();
  soldItemsSubscription.on("create", onItemSold);

  const itemsAddedQuery = new Moralis.Query('ItemsForSale');
  const itemsAddedSubscription = await itemsAddedQuery.subscribe();
  itemsAddedSubscription.on("create", onItemAdded);
}

onItemSold = async (item) => {
  const listing = document.getElementById(`item-${item.attributes.uid}`);
  if (listing){
      listing.parentNode.removeChild(listing);
  }
  
  user = await Moralis.User.current();
  if (user){
      const params = {uid: `${item.attributes.uid}`};
      const soldItem = await Moralis.Cloud.run('getItem', params);
      if (soldItem){
          if (user.get('accounts').includes(item.attributes.buyer)){
              getAndRenderItemData(soldItem, renderUserItem);
          }

          const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
          if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
        
      }
 
  }
}

onItemAdded = async (item) => {
  const params = {uid: `${item.attributes.uid}`};
  const addedItem = await Moralis.Cloud.run('getItem', params);
  if (addedItem){
      user = await Moralis.User.current();
      if (user){
          if (user.get('accounts').includes(addedItem.ownerOf)){
              const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
              if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);

              getAndRenderItemData(addedItem, renderUserItem);
              return;
          }
      }
      getAndRenderItemData(addedItem, renderItem);
  }

}

initUser = async () => {
  if (await Moralis.User.current()){
      hideElement(userConnectButton);
      showElement(userProfileButton);
      showElement(openCreateItemButton);
      showElement(openUserItemsButton);
      loadUserItems();
  }else{
      showElement(userConnectButton);
      hideElement(userProfileButton);
      hideElement(openCreateItemButton);
      hideElement(openUserItemsButton);
  }
}

login = async () => {
  try {
      await Moralis.Web3.authenticate();
      initUser();
  } catch (error) {
      alert(error)
  }
}

logout = async () => {
  await Moralis.User.logOut();
  hideElement(userInfo);
  initUser();
}

openUserInfo = async () => {
  user = await Moralis.User.current();
  if (user){    
      const email = user.get('email');
      if(email){
          userEmailField.value = email;
      }else{
          userEmailField.value = "";
      }

      userUsernameField.value = user.get('username');

      const userAvatar = user.get('avatar');
      if(userAvatar){
          userAvatarImg.src = userAvatar.url();
          showElement(userAvatarImg);
      }else{
          hideElement(userAvatarImg);
      }

      $('#userInfo').modal('show');
  }else{
      login();
  }
}

saveUserInfo = async () => {
  user.set('email', userEmailField.value);
  if (userEmailField){
    alert ("The email is already registerd bruh")
  }
  user.set('username', userUsernameField.value);
  if (userUsernameField){
    alert ("That name is already taken bruh")
  }

  if (userAvatarFile.files.length > 0) {
      const avatar = new Moralis.File("avatar1.jpg", userAvatarFile.files[0]);
      user.set('avatar', avatar);
  }

  await user.save();
  alert("User info saved successfully!");
  openUserInfo();
}

createItem = async () => {

  if (createItemFile.files.length == 0){
      alert("U forgot to add the file");
      return;
  } else if (createItemNameField.value.length == 0){
      alert("whats the name of the song?");
      return;   
  }

  if (selectItemImage.files.length == 0){
    alert(" it aint gon look right without a pic");
    return;
  }

  const nftFile = new Moralis.File("nftFile.mp4",createItemFile.files[0]);
  await nftFile.saveIPFS();

  const nftFilePath = nftFile.ipfs();

  const nftImgFile = new Moralis.File("nftFile.jpeg",createItemImage.files[0]);
  await nftImgFile.saveIPFS();

  const nftImgFilePath = nftImgFile.ipfs();

  const metadata = {
      name: createItemNameField.value,
      description: createItemDescriptionField.value,
      image: nftFilePath,
      picture: nftImgFilePath,
  };

  const nftFileMetadataFile = new Moralis.File("metadata.json", {base64 : btoa(JSON.stringify(metadata))});
  await nftFileMetadataFile.saveIPFS();

  const nftFileMetadataFilePath = nftFileMetadataFile.ipfs();

  const nftId = await mintNft(nftFileMetadataFilePath);

  user = await Moralis.User.current();
  const userAddress = user.get('ethAddress');

  switch(createItemStatusField.value){
      case "0":
          return;
      case "1":
          await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
          await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({from: userAddress });
          break;
      case "2":
          alert("Not yet supported!");
          return;
  }
  console.log(metadata);
}

mintNft = async (metadataUrl) => {
  const receipt = await tokenContract.methods.createItem(metadataUrl).send({from: ethereum.selectedAddress});
  console.log(receipt);
  return receipt.events.Transfer.returnValues.tokenId;
}

openUserItems = async () => {
  user = await Moralis.User.current();
  if (user){    
    $('#userItems').modal('show');
    
    
  }else{
    login();
  }
}

loadUserItems = async () => {
  const ownedItems = await Moralis.Cloud.run("getUserItems");
  ownedItems.forEach(item => {
    const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
    if (userItemListing) return;
    getAndRenderItemData(item, renderUserItem);
  });
  console.log(ownedItems);
}

loadItems = async () => {
  const items = await Moralis.Cloud.run("getItems");
  user = await Moralis.User.current();
  items.forEach(item => {
    if (user){
          if (user.attributes.accounts.includes(item.ownerOf)){
            const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
            if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
            getAndRenderItemData(item, renderUserItem);
            return;
          }
      }
      getAndRenderItemData(item, renderItem);
  });
}

initTemplate = (id) => {
  const template = document.getElementById(id);
  template.id = "";
  template.parentNode.removeChild(template);
  return template;
}

renderUserItem = async (item) => {
  const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
  if (userItemListing) return;

  const userItem = userItemTemplate.cloneNode(true);
  userItem.getElementsByTagName("audio")[0].src = item.image;
  userItem.getElementsByTagName("audio")[0].alt = item.name;
  userItem.getElementsByTagName("h5")[0].innerText = item.name;
  userItem.getElementsByTagName("p")[0].innerText = item.description;
  userItem.getElementsByTagName("img")[0].src = item.picture;
  

  userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
  userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
  userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
  userItem.getElementsByTagName("button")[0].onclick = async () => {
      user = await Moralis.User.current();
      if (!user){
          login();
          return;
      }
      await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
      await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({from: user.get('ethAddress') });
  };

  userItem.id = `user-item-${item.tokenObjectId}`
  userItems.appendChild(userItem);
  console.log(userItem);
}

renderItem = (item) => {
  const itemForSale = marketplaceItemTemplate.cloneNode(true);
  console.log(marketplaceItemTemplate);
  if (item.sellerAvatar){
      itemForSale.getElementsByTagName("img")[0].src = item.sellerAvatar.url();
      itemForSale.getElementsByTagName("img")[0].alt = item.sellerUsername;
   
  }

  itemForSale.getElementsByTagName("img")[1].src = item.image;
  itemForSale.getElementsByTagName("img")[1].alt = item.name;
  itemForSale.getElementsByTagName("h5")[0].innerText = item.name;
  itemForSale.getElementsByTagName("p")[0].innerText = item.description;

  itemForSale.getElementsByTagName("button")[0].innerText = `Buy for ${item.askingPrice}`;
  itemForSale.getElementsByTagName("button")[0].onclick = () => buyItem(item);
  itemForSale.id = `item-${item.uid}`;
  itemsForSale.appendChild(itemForSale);
}

getAndRenderItemData = (item, renderFunction) => {
  
  fetch(item.tokenUri)
  .then(response => response.json())
  .then(data => {
    item.name = data.name;
    item.description = data.description;
      item.image = data.image;
      item.picture = data.picture;
      renderFunction(item);
      console.log(item);
  })
}

ensureMarketplaceIsApproved = async (tokenId, tokenAddress) => {
  user = await Moralis.User.current();
  const userAddress = user.get('ethAddress');
  const contract = new web3.eth.Contract(tokenContractAbi, tokenAddress);
  const approvedAddress = await contract.methods.getApproved(tokenId).call({from: userAddress});
  if (approvedAddress != MARKETPLACE_CONTRACT_ADDRESS){
      await contract.methods.approve(MARKETPLACE_CONTRACT_ADDRESS,tokenId).send({from: userAddress});
  }
}

buyItem = async (item) => {
  user = await Moralis.User.current();
  if (!user){
      login();
      return;
  } 
  await marketplaceContract.methods.buyItem(item.uid).send({from: user.get('ethAddress'), value: item.askingPrice});
}

hideElement = (element) => element.style.display = "none";
showElement = (element) => element.style.display = "block";

// Navbar
const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;

const userProfileButton = document.getElementById("btnUserInfo");
userProfileButton.onclick = openUserInfo;

const openCreateItemButton = document.getElementById("btnOpenCreateItem");
openCreateItemButton.onclick = () => $('#createItem').modal('show');

//  User profile
const userInfo = document.getElementById("userInfo");
const userUsernameField = document.getElementById("txtUsername");
const userEmailField = document.getElementById("txtEmail");
const userAvatarImg = document.getElementById("imgAvatar");
const userAvatarFile = document.getElementById("fileAvatar");

document.getElementById("btnCloseUserInfo").onclick = () => hideElement(userInfo);
document.getElementById("btnLogout").onclick = logout;
document.getElementById("btnSaveUserInfo").onclick = saveUserInfo;

// Item creation
const createItemForm = document.getElementById("createItem");

const createItemImageField = document.getElementById("selectItemImage");
const createItemNameField = document.getElementById("txtCreateItemName");
const createItemDescriptionField = document.getElementById("txtCreateItemDescription");
const createItemPriceField = document.getElementById("numCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemStatus");
const createItemFile = document.getElementById("fileCreateItemFile");
const createItemImage = document.getElementById("selectItemImage");
document.getElementById("btnCloseCreateItem").onclick = () => hideElement(createItemForm);
document.getElementById("btnCreateItem").onclick = createItem;

// User items
const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemsButton = document.getElementById("btnMyItems");
openUserItemsButton.onclick = openUserItems;
// document.getElementById("btnUserInfo").onclick = () => hideElement(marketplaceItemTemplate);

//focus items
document.getElementById("btnCloseFocusItems").onclick = () => hideElement(focusItems);
document.getElementsByClassName("card-img-top").onclick = () => $('card-img-top').modal('show');

const userItemTemplate = initTemplate("itemTemplate");
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

// Items for sale
const itemsForSale = document.getElementById("itemsForSale");

// document.getElementById("testId").src="https://ipfs.moralis.io:2053/ipfs/QmdxPLoSoLdzLvoc1nBEHdP1Mp3csmMgkGD6KqvetP47c5";

init();