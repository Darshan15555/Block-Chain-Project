// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundTracking {
    address public authority;

    enum ProjectStatus { Created, Active, Completed, Suspended }

    struct Project {
        string projectId;
        address payable contractorAddress;
        uint256 totalFunds;
        uint256 releasedFunds;
        uint256 spentFunds;
        ProjectStatus status;
        bool exists;
    }

    struct Expense {
        string projectId;
        uint256 amount;
        bytes32 dataHash;
        uint256 timestamp;
    }

    mapping(string => Project) public projects;
    mapping(string => Expense[]) public projectExpenses;
    string[] public projectIds;

    event AuthorityDeposited(uint256 amount, uint256 timestamp);
    event ProjectCreated(string projectId, address contractorAddress, uint256 totalFunds, uint256 timestamp);
    event ExpenseLogged(string projectId, uint256 amount, bytes32 dataHash, uint256 timestamp);
    event FundsReleased(string projectId, address contractorAddress, uint256 amount, uint256 timestamp);
    event ProjectStatusUpdated(string projectId, ProjectStatus newStatus, uint256 timestamp);

    modifier onlyAuthority() {
        require(msg.sender == authority, "Only authority can call this function");
        _;
    }

    modifier projectExists(string memory projectId) {
        require(projects[projectId].exists, "Project does not exist");
        _;
    }

    constructor() {
        authority = msg.sender;
    }

    receive() external payable {
        emit AuthorityDeposited(msg.value, block.timestamp);
    }

    function depositTreasury() external payable onlyAuthority {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        emit AuthorityDeposited(msg.value, block.timestamp);
    }

    function createProject(
        string memory projectId,
        address payable contractorAddress,
        uint256 totalFunds
    ) public payable onlyAuthority {
        require(!projects[projectId].exists, "Project already exists");
        require(contractorAddress != address(0), "Invalid contractor address");
        require(totalFunds > 0, "Total funds must be greater than 0");
        require(msg.value == totalFunds, "Locked amount must equal total funds");

        projects[projectId] = Project({
            projectId: projectId,
            contractorAddress: contractorAddress,
            totalFunds: totalFunds,
            releasedFunds: 0,
            spentFunds: 0,
            status: ProjectStatus.Active,
            exists: true
        });

        projectIds.push(projectId);

        emit ProjectCreated(projectId, contractorAddress, totalFunds, block.timestamp);
    }

    function logExpense(
        string memory projectId,
        uint256 amount,
        bytes32 dataHash
    ) public projectExists(projectId) {
        Project storage project = projects[projectId];

        require(
            msg.sender == project.contractorAddress || msg.sender == authority,
            "Only contractor or authority can log expenses"
        );
        require(project.status == ProjectStatus.Active, "Project is not active");
        require(amount > 0, "Amount must be greater than 0");
        require(
            project.spentFunds + amount <= project.releasedFunds,
            "Expense exceeds released funds"
        );

        project.spentFunds += amount;

        projectExpenses[projectId].push(Expense({
            projectId: projectId,
            amount: amount,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit ExpenseLogged(projectId, amount, dataHash, block.timestamp);
    }

    function releaseFunds(
        string memory projectId,
        uint256 amount
    ) public onlyAuthority projectExists(projectId) {
        Project storage project = projects[projectId];

        require(project.status == ProjectStatus.Active, "Project is not active");
        require(amount > 0, "Amount must be greater than 0");
        require(
            project.releasedFunds + amount <= project.totalFunds,
            "Release amount exceeds total funds"
        );
        require(address(this).balance >= amount, "Insufficient contract balance");

        project.releasedFunds += amount;

        (bool sent, ) = project.contractorAddress.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(projectId, project.contractorAddress, amount, block.timestamp);
    }

    function updateProjectStatus(
        string memory projectId,
        ProjectStatus newStatus
    ) public onlyAuthority projectExists(projectId) {
        projects[projectId].status = newStatus;
        emit ProjectStatusUpdated(projectId, newStatus, block.timestamp);
    }

    function getProject(string memory projectId)
        public
        view
        projectExists(projectId)
        returns (
            string memory,
            address,
            uint256,
            uint256,
            uint256,
            ProjectStatus
        )
    {
        Project memory p = projects[projectId];
        return (
            p.projectId,
            p.contractorAddress,
            p.totalFunds,
            p.releasedFunds,
            p.spentFunds,
            p.status
        );
    }

    function getProjectDetails(string memory projectId)
        public
        view
        returns (
            string memory,
            address,
            uint256,
            uint256,
            uint256,
            ProjectStatus
        )
    {
        return getProject(projectId);
    }

    function getProjectExpenses(string memory projectId)
        public
        view
        projectExists(projectId)
        returns (Expense[] memory)
    {
        return projectExpenses[projectId];
    }

    function getProjectCount() public view returns (uint256) {
        return projectIds.length;
    }

    function getAllProjectIds() public view returns (string[] memory) {
        return projectIds;
    }

    function getTreasuryBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
