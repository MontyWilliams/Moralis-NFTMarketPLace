

const serverUrl = "https://5afgk9nae19l.usemoralis.com:2053/server";
const appId = "lhSPMJb08k6pB25ESY87s7VxvnNZobzHLWHbs8yj";
Moralis.start({ serverUrl, appId });

const TOKEN_CONTRACT_ADDRESS = "0x9Fa3ee20B8238f0e7b4ccC27Be91d50380E8D268";
const MARKETPLACE_CONTRACT_ADDRESS = "0x1073E8266785015098b3A0eb047A767f5B80C205";


init = async () => {
  hideElement(userItemsSection);
  hideElement(userInfo);
  hideElement(createItemForm);
  window.web3 = await Moralis.enableWeb3();
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
  if (await Moralis.User.current())
  {
    window.web3 = await Moralis.enableWeb3();
    window.tokenContract = new web3.eth.Contract(tokenContractAbi, TOKEN_CONTRACT_ADDRESS);
    hideElement(userConnectButton);
    showElement(userProfileButton);
    showElement(openCreateItemButton);
    showElement(openUserItemsButton);
    loadUserItems();
  }
  else
  {
    showElement(userConnectButton);
    hideElement(userProfileButton);
    hideElement(openCreateItemButton);
    hideElement(openUserItemsButton);
  } 
}

//  initUser();

login = async () => {
  try {
      await Moralis.Web3.authenticate();
      initUser();
  } catch (error) {
      alert(error)
  }
}

logOut = async ()  =>{
  await Moralis.User.logOut();
  hideElement(userInfo);
  initUser();
}

openUserInfo = async () => {
  user = await Moralis.User.current();
  //console.log(user);
  if (user)
  {
    const email = user.get('email');
    if(email){
      userEmailField.value = email;
    }else{
      userUsernameField.value = "";
    }
    userUsernameField.value = user.get('username');
    
    const userAvatar = user.get('avatar');
    if(userAvatar){
      userAvatarImg.src = userAvatar.url();
      showElement(userAvatarImg)
    } else{
      hideElement(userAvatarImg);
    }
    showElement(userInfo);
  }
  else
  {
    login();
  }
}

saveUserInfo = async () => {
  user.set('email', userEmailField.value);
  user.set('username', userUsernameField.value);
  
  if (userAvatarFile.files.length > 0){
    // Moralis can handle any kind of file but her we specify jpegS
    const avatar = new Moralis.File("avatar.jpg", userAvatarFile.files[0]);
    //dont worry about name colisions theyr given names and track by element Id
    user.set('avatar', avatar);
  }
  await user.save();
  alert("We got your info stored!");
  openUserInfo();
}


createItem = async () => {
  if (createItemFile.files.length == 0){
    alert("Are you gonna select a file?");
    return;
  } else if (createItemNameField.value.length == 0){
    alert("You need to give the file a name!");
    return;
  }
  
  const nftFile = new Moralis.File("nftFile",createItemFile.files[0]);
  await nftFile.saveIPFS();
  
  const nftFilePath = nftFile.ipfs();
  const nftFileHash = nftFile.hash();
  
  const metadata = {
    name: createItemNameField.value,
    description: createItemDescriptionField.value,
    image: nftFilePath,
  };
  
 const nftFileMetadataFile = new Moralis.File("metadata.json", {base64: btoa(JSON.stringify(metadata))});
 await nftFileMetadataFile.saveIPFS();
var nftFileMetadataFilePath = nftFileMetadataFile.ipfs();
var nftFileMetadataFileHash = nftFileMetadataFile.hash();

 const nftId = await mintNft(nftFileMetadataFilePath);
 
 const Item = Moralis.Object.extend("Item");
 //create new instance of the class
 const item = new Item(); 
 item.set('name', createItemNameField.value);
 item.set('description', createItemDescriptionField.value);
 item.set('nftFilePath', nftFilePath);
 item.set('nftFileHash', nftFileHash);
 item.set('nftFileMetadataFilePath', nftFileMetadataFilePath);
 item.set('MetadataFileHash', nftFileMetadataFileHash);
 item.set('nftId', nftId);
 item.set('nftContractAddress', TOKEN_CONTRACT_ADDRESS);
 await item.save();
 console.log(item);

 user = await Moralis.User.current();
 console.log(user);
    const userAddress = user.get('ethAddress');

    switch(createItemStatusField.value){
        case "0":
            return;
        case "1":
            await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
            await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({from: userAddress});
            break;
        case "2":
            alert("Not yet supported!");
            return;
    }
}

mintNft = async (metadataUrl) => {
  const receipt = await tokenContract.methods.createItem(metadataUrl).send({from: ethereum.selectedAddress});
  console.log(receipt);
  return receipt.events.Transfer.returnValues.tokenId;
}

openUserItems = async () => {
  user = await Moralis.User.current();
  if (user){    
    showElement(userItemsSection);
    console.log(userItemsSection);
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
    })
    console.log(items);
}

initTemplate = (id) => {
  const template = document.getElementById(id);
  template.id = "";
  template.parentNode.removeChild(template);
  return template;
}

renderUserItem = (item) => {
  const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
  if (userItemListing) return;

  const userItem = userItemTemplate.cloneNode(true);
  userItem.getElementsByTagName("img")[0].src = item.image;
  userItem.getElementsByTagName("img")[0].alt = item.name;
  userItem.getElementsByTagName("h5")[0].innerText = item.name;
  userItem.getElementsByTagName("p")[0].innerText = item.description;
  userItem.Id = `user-item-${item.tokenObjectId}`
  userItems.appendChild(userItem);

}

renderItem = (item) => {
  const itemForSale = marketplaceItemTemplate.cloneNode(true);
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
    renderFunction(item);
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
   console.log(item);
  await marketplaceContract.methods.buyItem(item.uid).send({from: user.get('ethAddress'), value: item.askingPrice});
}

hideElement = (element) => element.style.display = "none";
showElement = (element) => element.style.display = "block";

//NavBar
const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;

const openCreateItemButton = document.getElementById("btnOpenCreateItem");
openCreateItemButton.onclick = () => showElement(createItemForm);

//User Profile
const userProfileButton = document.getElementById("btnUserInfo");
userProfileButton.onclick = openUserInfo;

const userInfo = document.getElementById("userInfo");
const userUsernameField = document.getElementById("txtUsername");
const userEmailField = document.getElementById("txtEmail");
const userAvatarImg = document.getElementById("imgAvater");
const userAvatarFile = document.getElementById("fileAvatar");

document.getElementById("btnCloseUserInfo").onclick = () => hideElement(userInfo);
document.getElementById("btnSaveUserInfo").onclick = saveUserInfo;
document.getElementById("btnLogout").onclick = logOut;

//Item Creation
const createItemForm = document.getElementById("createItem");

const createItemNameField = document.getElementById("txtCreateItemName");
const createItemDescriptionField = document.getElementById("txtCreateItemDescription");
const createItemPriceField = document.getElementById("numberCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemsStatus");
const createItemFile = document.getElementById("fileCreateItemFile");

document.getElementById("btnCloseCreateItem").onclick = () => hideElement(createItemForm);
document.getElementById("btnCreateItem").onclick = createItem;

// User Items

const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemsButton = document.getElementById("btnMyItems");
openUserItemsButton.onclick = openUserItems;

const userItemTemplate = initTemplate("itemTemplate");
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

// Items for sale
const itemsForSale = document.getElementById("itemsForSale");

init();