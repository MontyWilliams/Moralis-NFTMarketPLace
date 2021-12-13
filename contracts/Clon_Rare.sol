// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "../node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../node_modules/@openzeppelin/contracts/utils/Counters.sol";
import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract DCX918 is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

     constructor() ERC721 ("DCX918", "918X"){}

     struct Item {
         uint256 id;
         address creater;
         string uri;
     }
     mapping (uint256 => Item) public Items;

     function createItem(string memory uri) public returns (uint256){
         _tokenIds.increment();
         uint256 newItemId = _tokenIds.current();
         
         _safeMint(msg.sender, newItemId);

         Items[newItemId] = Item(newItemId, msg.sender, uri);

         return newItemId;
     }

    function tokenURI(uint256 tokenId) override view public returns (string memory) {
        require(_exists(tokenId), "Query to see if metadata exists");
        return Items[tokenId].uri;
    }
}
