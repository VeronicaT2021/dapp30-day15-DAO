const { expectRevert, time } = require('@openzeppelin/test-helpers');
const DAO = artifacts.require('DAO');

contract('DAO', (accounts) => {
  let dao;

  const [investor1, investor2, investor3] = [accounts[1], accounts[2], accounts[3]];
  before(async () => {
    dao = await DAO.new(2, 2, 50);
  });

  it('Should accept contribution', async () => {
    await dao.contribute({ from: investor1, value: 100 })
    await dao.contribute({ from: investor2, value: 100 })
    await dao.contribute({ from: investor3, value: 100 })
    assert((await dao.investors(investor1)))
    assert((await dao.investors(investor2)))
    assert((await dao.investors(investor3)))
  });

  it('Should NOT accept contribution after contributionTime', async () => {
    await time.increase(2001)
    await expectRevert(
      dao.contribute({ from: accounts[4], value: 100 }),
      'cannot contribute after contributionEnd'
    )
  });

  it('Should create proposal', async () => {
    await dao.createProposal("Proposal 1", 50, accounts[4], { from: investor1 });
    var actualProposal = await dao.proposals(0);
    assert(actualProposal.name === "Proposal 1")
    assert(actualProposal.amount.toNumber() === 50)
    assert(actualProposal.recipient === accounts[4])
  });

  it('Should NOT create proposal if not from investor', async () => {
    await expectRevert(
      dao.createProposal("Proposal Nah", 100, accounts[4], { from: accounts[4] }),
      'only investors'
    )
  });

  it('Should NOT create proposal if amount too big', async () => {
    await expectRevert(
      dao.createProposal("Proposal Nah", 400, accounts[4], { from: investor1 }),
      'amount too big'
    )
  });

  it('Should vote', async () => {
    await dao.createProposal("Proposal 2", 50, accounts[4], { from: investor1 });
    await dao.vote(1, { from: investor2 })
    await dao.vote(1, { from: investor3 })
    var actualProposal = await dao.proposals(1);
    assert(actualProposal.votes.toNumber() == 200)
  });

  it('Should NOT vote if not investor', async () => {
    await expectRevert(
      dao.vote(1, { from: accounts[4] }),
      'only investors'
    )
  });

  it('Should NOT vote if already voted', async () => {
    await expectRevert(
      dao.vote(1, { from: investor2 }),
      'investor can only vote once for a proposal'
    )
  });

  it('Should NOT vote if after proposal end date', async () => {
    await time.increase(2001)
    await expectRevert(
      dao.vote(1, { from: investor1 }),
      'can only vote until proposal end date'
    )
  });

  it('Should execute proposal', async () => {
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[4]));
    await dao.executeProposal(1, { from: accounts[0] })
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[4]));
    assert(balanceAfter.sub(balanceBefore).toNumber() === 50);
    assert((await dao.proposals(1)).executed === true)
  });

  it('Should NOT execute proposal if not enough votes', async () => {
    await expectRevert(
      dao.executeProposal(0, { from: accounts[0] }),
      'cannot execute proposal with votes # below quorum'
    )
  });

  it('Should NOT execute proposal twice', async () => {
    await expectRevert(
      dao.executeProposal(1, { from: accounts[0] }),
      'cannot execute proposal already executed'
    )
  });

  it('Should NOT execute proposal before end date', async () => {
    await dao.createProposal("Proposal 3", 50, accounts[4], { from: investor1 });
    await dao.vote(2, { from: investor2 })
    await dao.vote(2, { from: investor3 })
    await expectRevert(
      dao.executeProposal(2, { from: accounts[0] }),
      'cannot execute proposal before end date'
    )
  });

  it('Should withdraw ether', async () => {
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[4]));
    await dao.withdrawEther(50, accounts[4], { from: accounts[0] })
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[4]));
    assert(balanceAfter.sub(balanceBefore).toNumber() === 50);
  });

  it('Should NOT withdraw ether if not admin', async () => {
    await expectRevert(
      dao.withdrawEther(50, accounts[4], { from: investor1 }),
      'only admin'
    )
  });

  it('Should NOT withdraw ether if trying to withdraw too much', async () => {
    await expectRevert(
      dao.withdrawEther(500, accounts[4], { from: accounts[0] }),
      'not enough availableFunds'
    )
  });
});
