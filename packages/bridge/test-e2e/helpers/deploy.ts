import { ethers } from 'hardhat'
import { Signer } from 'ethers'
import { deployUsingFactory } from './utils'
import { ArbDai, ArbDai__factory, Dai, L1DaiGateway, L1Escrow, L2DaiGateway } from '../../typechain'
import { getAddressOfNextDeployedContract } from './address'
import { expect } from 'chai'
import { MAX_UINT256 } from '../../test/helpers/helpers'

interface Dependencies {
  l1: {
    deployer: Signer
    dai: string
    router: string
    inbox: string
  }

  l2: {
    deployer: Signer
    router: string
    arbRetryableTx: string
  }
}

export async function deploy(deps: Dependencies) {
  const l1Escrow = await deployUsingFactory(deps.l1.deployer, await ethers.getContractFactory('L1Escrow'), [])
  console.log('Deployed l1Escrow at: ', l1Escrow.address)

  const l2Dai = await deployUsingFactory(deps.l2.deployer, await ethers.getContractFactory('ArbDai'), [deps.l1.dai])
  console.log('Deployed l2Dai at: ', l2Dai.address)
  const l1DaiGatewayFutureAddr = await getAddressOfNextDeployedContract(deps.l1.deployer)
  const l2DaiGateway = await deployUsingFactory(deps.l2.deployer, await ethers.getContractFactory('L2DaiGateway'), [
    l1DaiGatewayFutureAddr,
    deps.l2.router, // @todo: double check
    deps.l1.dai,
    l2Dai.address,
  ])
  console.log('Deployed l2DaiGateway at: ', l2DaiGateway.address)
  await l2Dai.rely(l2DaiGateway.address) // allow minting/burning from the bridge

  const l1DaiGateway = await deployUsingFactory(deps.l1.deployer, await ethers.getContractFactory('L1DaiGateway'), [
    l2DaiGateway.address,
    deps.l1.router,
    deps.l1.inbox,
    deps.l1.dai,
    l2Dai.address,
    l1Escrow.address,
  ])
  console.log('Deployed l1DaiGateway at: ', l1DaiGateway.address)
  expect(l1DaiGateway.address).to.be.eq(
    l1DaiGatewayFutureAddr,
    "Expected future address of l1DaiGateway doesn't match actual address!",
  )

  await l1Escrow.approve(deps.l1.dai, l1DaiGatewayFutureAddr, MAX_UINT256) // allow accessing escrow from the bridge

  return {
    l1DaiGateway,
    l1Escrow,
    l2Dai,
    l2DaiGateway,
    l1Dai: (await ethers.getContractAt('Dai', deps.l1.dai, deps.l1.deployer)) as Dai,
    arbRetryableTx: new ethers.Contract(
      deps.l2.arbRetryableTx,
      require('../../test/helpers/test-artifacts/ArbRetryableTx.json').abi,
      deps.l2.deployer,
    ),
  }
}

export async function useDeployment(deps: Dependencies) {
  const addresses = {
    l1DaiGateway: '0xFDc297d3827b329dc2eCdF9cB918644A56719Cd2',
    l1Escrow: '0x371015546206585D438D0cd655DBee7D86c7d4f2',
    l2Dai: '0xb6Bc3Adc7d46c0DC91bAf019EB864593baD84911',
    l2DaiGateway: '0x1320bF8f23b28b7b4160Bd08BA01AD70773957Ca',
    l1Dai: '0xd9e66A2f546880EA4d800F189d6F12Cc15Bff281',
    arbRetryableTx: '0x000000000000000000000000000000000000006E',
  }

  return {
    l1DaiGateway: (await ethers.getContractAt(
      'L1DaiGateway',
      addresses.l1DaiGateway,
      deps.l1.deployer,
    )) as L1DaiGateway,
    l1Escrow: (await ethers.getContractAt('L1Escrow', addresses.l1Escrow, deps.l1.deployer)) as L1Escrow,
    l2Dai: (await ethers.getContractAt('ArbDai', addresses.l2Dai, deps.l2.deployer)) as ArbDai,
    l2DaiGateway: (await ethers.getContractAt(
      'L2DaiGateway',
      addresses.l2DaiGateway,
      deps.l2.deployer,
    )) as L2DaiGateway,
    l1Dai: (await ethers.getContractAt('Dai', addresses.l1Dai, deps.l1.deployer)) as Dai,
    arbRetryableTx: new ethers.Contract(
      addresses.arbRetryableTx,
      require('../../test/helpers/test-artifacts/ArbRetryableTx.json').abi,
      deps.l2.deployer,
    ),
  }
}