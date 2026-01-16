// Main Application Logic
class HockeyDataApp {
    constructor() {
        this.data = {
            teams: [],
            games: [],
            players: [],
            leagues: [],
            divisions: [],
            seasons: []
        };
        this.filteredData = {};
        this.currentTab = 'teams';
        this.currentPlayerSubTab = 'skaters';
        this.sortState = {};
        this.pagination = {
            teams: { page: 1, perPage: 25 },
            cards: { page: 1, perPage: 15 },
            games: { page: 1, perPage: 25 },
            skaters: { page: 1, perPage: 20 },
            goalies: { page: 1, perPage: 20 }
        };
        this.teamsView = 'table'; // 'table' or 'cards'

        this.init();
    }

    async init() {
        try {
            // Load data using the data-loader
            this.showLoading(true);
            this.data = await loadHockeyData();

            // Debug: log loaded data counts
            console.log('Data loaded:', {
                teams: this.data.teams?.length || 0,
                games: this.data.games?.length || 0,
                players: this.data.players?.length || 0,
                seasons: this.data.seasons?.length || 0
            });

            // Initialize the app
            this.setupEventListeners();
            this.populateFilters();
            this.applyFilters();

            // Setup URL routing
            this.setupRouting();

            // Handle initial route or show default view
            if (!this.handleRoute()) {
                this.renderCurrentTab();
            }

            this.showLoading(false);
        } catch (error) {
            console.error('Init error:', error);
            this.showError('Failed to load data: ' + error.message);
        }
    }

    // URL Routing
    setupRouting() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    handleRoute() {
        const hash = window.location.hash;

        // Parse hash: #/season-name/team-name
        if (hash.startsWith('#/')) {
            const parts = hash.substring(2).split('/');
            if (parts.length >= 2) {
                const seasonSlug = decodeURIComponent(parts[0]);
                const teamSlug = decodeURIComponent(parts[1]);

                // Find matching team
                const team = this.findTeamBySlug(seasonSlug, teamSlug);
                if (team) {
                    this.showTeamPage(team.id);
                    return true;
                }
            }
        }

        // No valid route, show normal view
        this.hideTeamPage();
        return false;
    }

    findTeamBySlug(seasonSlug, teamSlug) {
        // Normalize for comparison - remove special chars except alphanumeric
        const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedSeasonSlug = normalize(seasonSlug);
        const normalizedTeamSlug = normalize(teamSlug);

        return this.data.teams.find(team => {
            const teamName = normalize(team.team_name);
            const seasonName = normalize(team.season_name);

            // Extract just the year part from season (e.g., "20182019" from "2018-2019 Season")
            const seasonYear = seasonName.replace(/season/g, '').trim();

            // Check if season matches
            const seasonMatch = seasonYear === normalizedSeasonSlug ||
                               seasonYear.includes(normalizedSeasonSlug) ||
                               normalizedSeasonSlug.includes(seasonYear);

            // Check if team name matches
            const teamMatch = teamName === normalizedTeamSlug;

            return seasonMatch && teamMatch;
        });
    }

    createTeamUrl(team) {
        // Create URL-friendly slugs
        const seasonSlug = (team.season_name || '')
            .split(' ')[0] // Get "2018-2019" from "2018-2019 Season"
            .toLowerCase();
        const teamSlug = (team.team_name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        return `#/${seasonSlug}/${teamSlug}`;
    }

    navigateToTeam(teamSeasonId) {
        const team = this.data.teams.find(t => t.id === teamSeasonId);
        if (team) {
            const url = this.createTeamUrl(team);
            window.location.hash = url.substring(1);
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Filters - Cascading dependencies:
        // Season -> League, Division, Team
        // Gender -> League, Division, Team
        // League -> Division, Team
        // Division -> Team
        document.getElementById('season-filter').addEventListener('change', () => {
            this.updateLeagueFilter();
            this.updateDivisionFilter();
            this.updateTeamFilter();
            this.applyFilters();
        });
        document.getElementById('gender-filter').addEventListener('change', () => {
            this.updateLeagueFilter();
            this.updateDivisionFilter();
            this.updateTeamFilter();
            this.applyFilters();
        });
        document.getElementById('league-filter').addEventListener('change', () => {
            this.updateDivisionFilter();
            this.updateTeamFilter();
            this.applyFilters();
        });
        document.getElementById('division-filter').addEventListener('change', () => {
            this.updateTeamFilter();
            this.applyFilters();
        });
        document.getElementById('team-filter').addEventListener('change', () => this.applyFilters());

        // Search with debounce
        let searchTimeout;
        document.getElementById('search').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.applyFilters(), 300);
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                this.sortTable(e.target);
            });
        });

        // Player sub-tabs (Skaters/Goalies)
        document.querySelectorAll('.sub-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchPlayerSubTab(e.target.dataset.subtab);
            });
        });
    }

    populateFilters() {
        // Populate season filter (seasons are always all available)
        const seasonFilter = document.getElementById('season-filter');
        this.data.seasons.forEach(season => {
            const option = document.createElement('option');
            option.value = season.id;
            option.textContent = season.name;
            seasonFilter.appendChild(option);
        });

        // Set default season to 2018-2019 (ID: 11) or the most recent season
        const defaultSeasonId = '11'; // 2018-2019 Season
        const hasDefaultSeason = this.data.seasons.some(s => s.id === defaultSeasonId);
        if (hasDefaultSeason) {
            seasonFilter.value = defaultSeasonId;
        } else if (this.data.seasons.length > 0) {
            // Fallback to the last (most recent) season
            seasonFilter.value = this.data.seasons[this.data.seasons.length - 1].id;
        }

        // Initial cascading filter population
        this.updateLeagueFilter();
        this.updateDivisionFilter();
        this.updateTeamFilter();
    }

    // Get teams filtered by current season and gender selections
    getFilteredTeamsForDropdowns() {
        const seasonId = document.getElementById('season-filter').value;
        const gender = document.getElementById('gender-filter').value;

        let teams = this.data.teams;
        if (seasonId) {
            teams = teams.filter(t => t.season_id === seasonId);
        }
        if (gender) {
            teams = teams.filter(t => t.gender === gender);
        }
        return teams;
    }

    updateLeagueFilter() {
        const leagueFilter = document.getElementById('league-filter');
        const currentValue = leagueFilter.value;

        // Clear existing options
        leagueFilter.innerHTML = '<option value="">All Leagues</option>';

        // Get teams filtered by season and gender
        const teams = this.getFilteredTeamsForDropdowns();

        // Get unique leagues from filtered teams
        const leagueMap = new Map();
        teams.forEach(team => {
            if (team.league_id && team.league_name) {
                leagueMap.set(team.league_id, team.league_name);
            }
        });

        // Sort leagues alphabetically
        const sortedLeagues = [...leagueMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

        sortedLeagues.forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            leagueFilter.appendChild(option);
        });

        // Restore previous value if still available, otherwise reset
        if ([...leagueMap.keys()].includes(currentValue)) {
            leagueFilter.value = currentValue;
        } else {
            leagueFilter.value = '';
        }
    }

    updateDivisionFilter() {
        const divisionFilter = document.getElementById('division-filter');
        const leagueId = document.getElementById('league-filter').value;
        const currentValue = divisionFilter.value;

        // Clear existing options
        divisionFilter.innerHTML = '<option value="">All Divisions</option>';

        // Get teams filtered by season and gender
        let teams = this.getFilteredTeamsForDropdowns();

        // Further filter by league if selected
        if (leagueId) {
            teams = teams.filter(t => t.league_id === leagueId);
        }

        // Get unique divisions from filtered teams
        const divisionMap = new Map();
        teams.forEach(team => {
            if (team.division_id && team.division_name) {
                divisionMap.set(team.division_id, team.division_name);
            }
        });

        // Sort divisions
        const sortedDivisions = [...divisionMap.entries()].sort((a, b) => {
            // Try to sort by division number if present
            const aNum = parseInt(a[1].match(/\d+/)?.[0]) || 99;
            const bNum = parseInt(b[1].match(/\d+/)?.[0]) || 99;
            if (aNum !== bNum) return aNum - bNum;
            return a[1].localeCompare(b[1]);
        });

        sortedDivisions.forEach(([id, name]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            divisionFilter.appendChild(option);
        });

        // Restore previous value if still available, otherwise reset
        if ([...divisionMap.keys()].includes(currentValue)) {
            divisionFilter.value = currentValue;
        } else {
            divisionFilter.value = '';
        }
    }

    updateTeamFilter() {
        const teamFilter = document.getElementById('team-filter');
        const leagueId = document.getElementById('league-filter').value;
        const divisionId = document.getElementById('division-filter').value;
        const currentValue = teamFilter.value;

        // Clear existing options
        teamFilter.innerHTML = '<option value="">All Teams</option>';

        // Get teams filtered by season and gender
        let teams = this.getFilteredTeamsForDropdowns();

        // Further filter by league and division if selected
        if (leagueId) {
            teams = teams.filter(t => t.league_id === leagueId);
        }
        if (divisionId) {
            teams = teams.filter(t => t.division_id === divisionId);
        }

        // Get unique team names and sort alphabetically
        const uniqueTeams = [...new Map(teams.map(t => [t.team_id, t])).values()];
        uniqueTeams.sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''));

        uniqueTeams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.team_id;
            option.textContent = team.team_name;
            teamFilter.appendChild(option);
        });

        // Restore previous value if still available, otherwise reset
        const teamIds = uniqueTeams.map(t => t.team_id);
        if (teamIds.includes(currentValue)) {
            teamFilter.value = currentValue;
        } else {
            teamFilter.value = '';
        }
    }

    applyFilters() {
        const seasonId = document.getElementById('season-filter').value;
        const gender = document.getElementById('gender-filter').value;
        const leagueId = document.getElementById('league-filter').value;
        const divisionId = document.getElementById('division-filter').value;
        const teamId = document.getElementById('team-filter').value;
        const searchTerm = document.getElementById('search').value.toLowerCase();

        // Filter teams (team_seasons data)
        this.filteredData.teams = this.data.teams.filter(team => {
            if (seasonId && team.season_id !== seasonId) return false;
            if (gender && team.gender !== gender) return false;
            if (leagueId && team.league_id !== leagueId) return false;
            if (divisionId && team.division_id !== divisionId) return false;
            if (teamId && team.team_id !== teamId) return false;
            if (searchTerm) {
                const searchableText = `${team.team_name} ${team.league_name}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) return false;
            }
            return true;
        });

        // Get team_season_ids for selected team (for game filtering)
        const selectedTeamSeasonIds = teamId
            ? this.data.teams.filter(t => t.team_id === teamId && (!seasonId || t.season_id === seasonId)).map(t => t.id)
            : [];

        // Get team_season_ids for selected gender (for game filtering)
        const genderTeamSeasonIds = gender
            ? new Set(this.data.teams.filter(t => t.gender === gender).map(t => t.id))
            : null;

        // Filter games
        this.filteredData.games = this.data.games.filter(game => {
            if (seasonId && game.season_id !== seasonId) return false;
            if (gender && genderTeamSeasonIds) {
                // Show games where at least one team matches the gender
                if (!genderTeamSeasonIds.has(game.home_team_season_id) &&
                    !genderTeamSeasonIds.has(game.away_team_season_id)) {
                    return false;
                }
            }
            if (teamId) {
                // Show games where selected team is home or away
                if (!selectedTeamSeasonIds.includes(game.home_team_season_id) &&
                    !selectedTeamSeasonIds.includes(game.away_team_season_id)) {
                    return false;
                }
            }
            if (searchTerm) {
                const searchableText = `${game.home_team} ${game.away_team} ${game.venue}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) return false;
            }
            return true;
        });

        // Get team_ids for selected gender (for player filtering)
        const genderTeamIds = gender
            ? new Set(this.data.teams.filter(t => t.gender === gender).map(t => t.team_id))
            : null;

        // Filter players
        this.filteredData.players = this.data.players.filter(player => {
            if (seasonId && player.season_id !== seasonId) return false;
            if (gender && genderTeamIds && !genderTeamIds.has(player.team_id)) return false;
            if (teamId && player.team_id !== teamId) return false;
            if (searchTerm) {
                const searchableText = `${player.name} ${player.team_name}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) return false;
            }
            return true;
        });

        // Debug: log filtered counts
        console.log('Filtered data:', {
            seasonId,
            gender,
            teamId,
            teams: this.filteredData.teams?.length,
            games: this.filteredData.games?.length,
            players: this.filteredData.players?.length
        });

        // Reset all pagination to page 1 when filters change
        this.pagination.teams.page = 1;
        this.pagination.cards.page = 1;
        this.pagination.games.page = 1;
        this.pagination.skaters.page = 1;
        this.pagination.goalies.page = 1;

        this.renderCurrentTab();
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');

        // Update active panel
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${tabName}-panel`).classList.add('active');

        this.currentTab = tabName;
        this.renderCurrentTab();
    }

    renderCurrentTab() {
        switch(this.currentTab) {
            case 'teams':
                this.renderTeams();
                break;
            case 'games':
                this.renderGames();
                break;
            case 'players':
                this.renderPlayers();
                break;
            case 'standings':
                this.renderStandings();
                break;
        }
    }

    renderTeams() {
        const tbody = document.querySelector('#teams-table tbody');
        const teams = this.filteredData.teams || [];
        const { page, perPage } = this.pagination.teams;
        const totalPages = Math.ceil(teams.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageTeams = teams.slice(startIndex, endIndex);

        // Update summary
        const summary = document.getElementById('teams-summary');
        const totalWins = teams.reduce((sum, t) => sum + (t.overall?.wins || t.wins || 0), 0);
        const totalGames = teams.reduce((sum, t) => {
            const o = t.overall || t;
            return sum + (o.wins || 0) + (o.losses || 0) + (o.ties || 0);
        }, 0);

        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${teams.length}</span>
                <span class="stat-label">Teams</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${totalGames}</span>
                <span class="stat-label">Total Games</span>
            </div>
        `;

        // Update info
        document.getElementById('teams-showing').textContent = pageTeams.length;
        document.getElementById('teams-total').textContent = teams.length;

        // Render table
        if (teams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state"><p>No teams found</p></td></tr>';
            document.getElementById('teams-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageTeams.map(team => {
            const record = team.overall || team;
            const pts = record.points || ((record.wins || 0) * 2 + (record.ties || 0));
            const winPct = record.win_pct ? (record.win_pct * 100).toFixed(1) + '%' : '-';
            return `
                <tr class="team-row" onclick="app.showTeamDetail('${team.id}')">
                    <td><a href="javascript:void(0)">${this.escapeHtml(team.team_name || team.name)}</a></td>
                    <td>${this.escapeHtml(team.league_name || '')}</td>
                    <td>${this.escapeHtml(team.division_name || '')}</td>
                    <td class="text-center">${record.wins || 0}</td>
                    <td class="text-center">${record.losses || 0}</td>
                    <td class="text-center">${record.ties || 0}</td>
                    <td class="text-center">${record.goals_for || 0}</td>
                    <td class="text-center">${record.goals_against || 0}</td>
                    <td class="text-center"><strong>${pts}</strong></td>
                    <td class="text-center">${winPct}</td>
                </tr>
            `;
        }).join('');

        // Render pagination
        this.renderPagination('teams', totalPages);

        // Also render cards if in card view
        if (this.teamsView === 'cards') {
            this.renderTeamCards();
        }
    }

    renderTeamCards() {
        const container = document.getElementById('teams-cards-list');
        const teams = this.filteredData.teams || [];
        const { page, perPage } = this.pagination.cards;
        const totalPages = Math.ceil(teams.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageTeams = teams.slice(startIndex, endIndex);

        // Update info
        document.getElementById('cards-showing').textContent = pageTeams.length;
        document.getElementById('cards-total').textContent = teams.length;

        if (teams.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No teams found</p></div>';
            document.getElementById('cards-pagination').innerHTML = '';
            return;
        }

        container.innerHTML = pageTeams.map(team => {
            const record = team.overall || team;
            const wins = record.wins || 0;
            const losses = record.losses || 0;
            const ties = record.ties || 0;
            const pts = record.points || (wins * 2 + ties);
            const initials = (team.team_name || 'T').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const genderLabel = team.gender === 'F' ? 'Girls' : 'Boys';

            return `
                <div class="team-card">
                    <div class="team-card-icon">${initials}</div>
                    <div class="team-card-info">
                        <div class="team-card-name">${this.escapeHtml(team.team_name || team.name)}</div>
                        <div class="team-card-links">
                            <a class="team-card-link" onclick="app.showTeamRecord('${team.id}')">Record: ${wins}-${losses}-${ties} (${pts} pts)</a>
                            <a class="team-card-link" onclick="app.showTeamRoster('${team.id}')">Roster</a>
                            <a class="team-card-link" onclick="app.showTeamSchedule('${team.id}')">Schedule</a>
                        </div>
                        <div class="team-card-meta">${this.escapeHtml(team.league_name || '')} | ${this.escapeHtml(team.division_name || '')} | ${genderLabel}</div>
                    </div>
                    <div class="team-card-actions">
                        <button class="btn-visit-team" onclick="app.showTeamDetail('${team.id}')">Visit Team</button>
                    </div>
                </div>
            `;
        }).join('');

        // Render pagination
        this.renderPagination('cards', totalPages);
    }

    switchTeamsView(view) {
        this.teamsView = view;

        // Update toggle buttons
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
                btn.classList.add('active');
            }
        });

        // Show/hide views
        if (view === 'table') {
            document.getElementById('teams-table-view').style.display = 'block';
            document.getElementById('teams-cards-view').style.display = 'none';
        } else {
            document.getElementById('teams-table-view').style.display = 'none';
            document.getElementById('teams-cards-view').style.display = 'block';
            this.renderTeamCards();
        }
    }

    showTeamRecord(teamSeasonId) {
        // Just show the team detail modal on the roster tab
        this.showTeamDetail(teamSeasonId);
    }

    showTeamDetailByGame(teamSeasonId, teamName) {
        // Try to find the team by team_season_id first
        let team = this.data.teams.find(t => t.id === teamSeasonId);

        // If not found, try to find by team name in current filtered data
        if (!team && teamName) {
            team = this.data.teams.find(t => t.team_name === teamName || t.name === teamName);
        }

        if (team) {
            this.showTeamDetail(team.id);
        } else {
            console.log('Team not found:', teamSeasonId, teamName);
        }
    }

    showTeamRoster(teamSeasonId) {
        // Show team detail modal and switch to roster tab
        this.showTeamDetail(teamSeasonId);
        // Roster tab is default, so no extra action needed
    }

    showTeamSchedule(teamSeasonId) {
        // Show team detail modal and switch to schedule tab
        this.showTeamDetail(teamSeasonId);
        // Switch to schedule tab after a brief delay to let modal open
        setTimeout(() => {
            const scheduleTab = document.querySelector('.modal-tab[data-modal-tab="schedule"]');
            if (scheduleTab) scheduleTab.click();
        }, 50);
    }

    renderGames() {
        const tbody = document.querySelector('#games-table tbody');
        const games = this.filteredData.games || [];
        const { page, perPage } = this.pagination.games;
        const totalPages = Math.ceil(games.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageGames = games.slice(startIndex, endIndex);

        // Update summary
        const summary = document.getElementById('games-summary');
        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${games.length}</span>
                <span class="stat-label">Games</span>
            </div>
        `;

        // Update info
        document.getElementById('games-showing').textContent = pageGames.length;
        document.getElementById('games-total').textContent = games.length;

        // Render table
        if (games.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No games found</p></td></tr>';
            document.getElementById('games-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageGames.map(game => `
            <tr>
                <td>${this.formatDate(game.date)}</td>
                <td><a href="javascript:void(0)" onclick="app.showTeamDetailByGame('${game.home_team_season_id}', '${game.home_team}')">${this.escapeHtml(game.home_team)}</a></td>
                <td><a href="javascript:void(0)" onclick="app.showTeamDetailByGame('${game.away_team_season_id}', '${game.away_team}')">${this.escapeHtml(game.away_team)}</a></td>
                <td class="text-center"><strong>${game.home_score ?? '-'} - ${game.away_score ?? '-'}</strong></td>
                <td>${this.escapeHtml(game.venue || '-')}</td>
            </tr>
        `).join('');

        // Render pagination
        this.renderPagination('games', totalPages);
    }

    renderPlayers() {
        const players = this.filteredData.players || [];

        // Separate skaters and goalies
        this.filteredData.skaters = players.filter(p => p.position !== 'Goalie');
        this.filteredData.goalies = players.filter(p => p.position === 'Goalie');

        // Sort skaters by points descending
        this.filteredData.skaters.sort((a, b) => (b.points || 0) - (a.points || 0));

        // Sort goalies by GAA ascending (lower is better)
        this.filteredData.goalies.sort((a, b) => (a.goals_against_average || 99) - (b.goals_against_average || 99));

        // Update summary
        const summary = document.getElementById('players-summary');
        const totalGoals = this.filteredData.skaters.reduce((sum, p) => sum + (p.goals || 0), 0);
        const totalAssists = this.filteredData.skaters.reduce((sum, p) => sum + (p.assists || 0), 0);

        summary.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${this.filteredData.skaters.length}</span>
                <span class="stat-label">Skaters</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${this.filteredData.goalies.length}</span>
                <span class="stat-label">Goalies</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${totalGoals}</span>
                <span class="stat-label">Total Goals</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${totalAssists}</span>
                <span class="stat-label">Total Assists</span>
            </div>
        `;

        // Reset to page 1 when filters change
        this.pagination.skaters.page = 1;
        this.pagination.goalies.page = 1;

        // Render both tables
        this.renderSkatersTable();
        this.renderGoaliesTable();
    }

    renderSkatersTable() {
        const tbody = document.querySelector('#skaters-table tbody');
        const skaters = this.filteredData.skaters || [];
        const { page, perPage } = this.pagination.skaters;
        const totalPages = Math.ceil(skaters.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageSkaters = skaters.slice(startIndex, endIndex);

        // Update info
        document.getElementById('skaters-showing').textContent = pageSkaters.length;
        document.getElementById('skaters-total').textContent = skaters.length;

        if (skaters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><p>No skaters found</p></td></tr>';
            document.getElementById('skaters-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageSkaters.map((player, index) => {
            const rank = startIndex + index + 1;
            return `
                <tr class="player-row" onclick="app.showPlayerDetail('${player.id}')">
                    <td class="rank">${rank}</td>
                    <td><a href="javascript:void(0)">${this.escapeHtml(player.name)}</a></td>
                    <td><a href="javascript:void(0)">${this.escapeHtml(player.team_name || '')}</a></td>
                    <td class="text-center">${player.year || '-'}</td>
                    <td class="text-center">${this.escapeHtml(player.position || '-')}</td>
                    <td>${this.escapeHtml(player.hometown || '-')}</td>
                    <td class="text-center">${player.goals || 0}</td>
                    <td class="text-center">${player.assists || 0}</td>
                    <td class="text-center"><strong>${player.points || 0}</strong></td>
                </tr>
            `;
        }).join('');

        // Render pagination
        this.renderPagination('skaters', totalPages);
    }

    renderGoaliesTable() {
        const tbody = document.querySelector('#goalies-table tbody');
        const goalies = this.filteredData.goalies || [];
        const { page, perPage } = this.pagination.goalies;
        const totalPages = Math.ceil(goalies.length / perPage);
        const startIndex = (page - 1) * perPage;
        const endIndex = startIndex + perPage;
        const pageGoalies = goalies.slice(startIndex, endIndex);

        // Update info
        document.getElementById('goalies-showing').textContent = pageGoalies.length;
        document.getElementById('goalies-total').textContent = goalies.length;

        if (goalies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="empty-state"><p>No goalies found</p></td></tr>';
            document.getElementById('goalies-pagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = pageGoalies.map((player, index) => {
            const rank = startIndex + index + 1;
            const gaa = player.goals_against_average ? player.goals_against_average.toFixed(2) : '-';
            const svPct = player.save_percentage ? (player.save_percentage * 100).toFixed(2) : '-';
            const gp = player.games_played ? player.games_played.toFixed(1) : '0';

            return `
                <tr class="player-row goalie-row" onclick="app.showPlayerDetail('${player.id}')">
                    <td class="rank">${rank}</td>
                    <td><a href="javascript:void(0)">${this.escapeHtml(player.name)}</a></td>
                    <td class="text-center">${player.year || '-'}</td>
                    <td class="text-center">Goalie</td>
                    <td>${this.escapeHtml(player.hometown || '-')}</td>
                    <td class="text-center">${gp}</td>
                    <td class="text-center">${player.goals_against || 0}</td>
                    <td class="text-center">${gaa}</td>
                    <td class="text-center">${player.shots || 0}</td>
                    <td class="text-center">${player.saves || 0}</td>
                    <td class="text-center">${svPct}</td>
                    <td class="text-center">${player.shutouts || 0}</td>
                </tr>
            `;
        }).join('');

        // Render pagination
        this.renderPagination('goalies', totalPages);
    }

    renderPagination(type, totalPages) {
        const container = document.getElementById(`${type}-pagination`);
        const currentPage = this.pagination[type].page;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';

        // Previous button
        html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="app.changePage('${type}', ${currentPage - 1})">&lt;</button>`;

        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button onclick="app.changePage('${type}', 1)">1</button>`;
            if (startPage > 2) html += '<span style="padding: 8px;">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="app.changePage('${type}', ${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span style="padding: 8px;">...</span>';
            html += `<button onclick="app.changePage('${type}', ${totalPages})">${totalPages}</button>`;
        }

        // Next button
        html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="app.changePage('${type}', ${currentPage + 1})">&gt;</button>`;

        container.innerHTML = html;
    }

    changePage(type, page) {
        this.pagination[type].page = page;
        switch(type) {
            case 'teams':
                this.renderTeams();
                break;
            case 'cards':
                this.renderTeamCards();
                break;
            case 'games':
                this.renderGames();
                break;
            case 'skaters':
                this.renderSkatersTable();
                break;
            case 'goalies':
                this.renderGoaliesTable();
                break;
        }
    }

    switchPlayerSubTab(subtab) {
        this.currentPlayerSubTab = subtab;

        // Update active tab
        document.querySelectorAll('.sub-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.sub-tab[data-subtab="${subtab}"]`).classList.add('active');

        // Update active panel
        document.querySelectorAll('.sub-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${subtab}-panel`).classList.add('active');
    }

    renderStandings() {
        const container = document.getElementById('standings-container');
        const teams = this.filteredData.teams || [];

        if (teams.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No standings data available</p></div>';
            return;
        }

        // Group teams by league (primary grouping for standings)
        const leagueStandings = {};
        teams.forEach(team => {
            const leagueName = team.league_name || 'Independent';

            if (!leagueStandings[leagueName]) {
                leagueStandings[leagueName] = [];
            }
            leagueStandings[leagueName].push(team);
        });

        // Sort teams within each group by overall win percentage/points
        const sortTeams = (teamList) => {
            return teamList.sort((a, b) => {
                // Sort by overall win percentage first
                const aOverall = a.overall || a;
                const bOverall = b.overall || b;
                const aWinPct = aOverall.win_pct || 0;
                const bWinPct = bOverall.win_pct || 0;
                if (bWinPct !== aWinPct) return bWinPct - aWinPct;

                // Then by points
                const aPts = aOverall.points || ((aOverall.wins || 0) * 2 + (aOverall.ties || 0));
                const bPts = bOverall.points || ((bOverall.wins || 0) * 2 + (bOverall.ties || 0));
                return bPts - aPts;
            });
        };

        // Sort leagues alphabetically, but Independent last
        const sortedLeagues = Object.keys(leagueStandings).sort((a, b) => {
            if (a.toLowerCase().includes('independent')) return 1;
            if (b.toLowerCase().includes('independent')) return -1;
            return a.localeCompare(b);
        });

        // Helper to calculate win percentage
        const calcWinPct = (record) => {
            if (!record) return '-';
            const totalGames = (record.wins || 0) + (record.losses || 0) + (record.ties || 0);
            if (totalGames === 0) return '-';
            const pts = (record.wins || 0) * 2 + (record.ties || 0);
            const maxPts = totalGames * 2;
            return ((pts / maxPts) * 100).toFixed(1) + '%';
        };

        let html = '';

        sortedLeagues.forEach(leagueName => {
            const leagueTeams = sortTeams(leagueStandings[leagueName]);

            html += `
                <div class="standings-section">
                    <div class="standings-header">
                        <h3>${this.escapeHtml(leagueName)}</h3>
                    </div>
                    <div class="standings-table-wrapper">
                        <!-- Split Header -->
                        <div class="standings-split-header">
                            <div class="header-team">
                                <div style="padding: 10px 15px; color: white; font-weight: 600; font-size: 0.85rem; height: 100%; display: flex; align-items: center;">TEAM</div>
                            </div>
                            <div class="header-section">
                                <div class="section-label league">LEAGUE/CONFERENCE</div>
                                <div class="section-columns">
                                    <th>W</th>
                                    <th>L</th>
                                    <th>T</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                    <th>PTS</th>
                                    <th>WIN%</th>
                                </div>
                            </div>
                            <div class="header-section">
                                <div class="section-label overall">OVERALL</div>
                                <div class="section-columns">
                                    <th>W</th>
                                    <th>L</th>
                                    <th>T</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                    <th>PTS</th>
                                    <th>WIN%</th>
                                </div>
                            </div>
                        </div>
                        <!-- Data Table -->
                        <table class="standings-data-table">
                            <tbody>
                                ${leagueTeams.map(team => {
                                    const league = team.league || {};
                                    const overall = team.overall || team;

                                    // League record
                                    const lWins = league.wins || 0;
                                    const lLosses = league.losses || 0;
                                    const lTies = league.ties || 0;
                                    const lGF = league.goals_for || 0;
                                    const lGA = league.goals_against || 0;
                                    const lPts = league.points || (lWins * 2 + lTies);
                                    const lWinPct = calcWinPct(league);

                                    // Overall record
                                    const oWins = overall.wins || 0;
                                    const oLosses = overall.losses || 0;
                                    const oTies = overall.ties || 0;
                                    const oGF = overall.goals_for || 0;
                                    const oGA = overall.goals_against || 0;
                                    const oPts = overall.points || (oWins * 2 + oTies);
                                    const oWinPct = calcWinPct(overall);

                                    return `
                                        <tr class="team-row" onclick="app.showTeamDetail('${team.id}')">
                                            <td><a href="javascript:void(0)">${this.escapeHtml(team.team_name || team.name)}</a></td>
                                            <td class="league-col">${lWins}</td>
                                            <td class="league-col">${lLosses}</td>
                                            <td class="league-col">${lTies}</td>
                                            <td class="league-col">${lGF}</td>
                                            <td class="league-col">${lGA}</td>
                                            <td class="league-col"><strong>${lPts}</strong></td>
                                            <td class="league-col">${lWinPct}</td>
                                            <td class="overall-col">${oWins}</td>
                                            <td class="overall-col">${oLosses}</td>
                                            <td class="overall-col">${oTies}</td>
                                            <td class="overall-col">${oGF}</td>
                                            <td class="overall-col">${oGA}</td>
                                            <td class="overall-col"><strong>${oPts}</strong></td>
                                            <td class="overall-col">${oWinPct}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    sortTable(headerElement) {
        const table = headerElement.closest('table');
        const sortKey = headerElement.dataset.sort;
        const tableType = headerElement.dataset.table; // e.g., 'teams', 'games', 'skaters', 'goalies'
        const currentSort = headerElement.classList.contains('sort-asc') ? 'asc' :
                           headerElement.classList.contains('sort-desc') ? 'desc' : 'none';

        // Reset all sort indicators in this table
        table.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // Determine new sort direction
        let newSort = 'asc';
        if (currentSort === 'none') newSort = 'asc';
        else if (currentSort === 'asc') newSort = 'desc';
        else newSort = 'asc';

        // Apply sort indicator
        headerElement.classList.add(newSort === 'asc' ? 'sort-asc' : 'sort-desc');

        // Get data array based on table type
        let dataArray;
        let renderFunction;

        switch(tableType) {
            case 'teams':
                dataArray = this.filteredData.teams;
                renderFunction = () => this.renderTeams();
                break;
            case 'games':
                dataArray = this.filteredData.games;
                renderFunction = () => this.renderGames();
                break;
            case 'skaters':
                dataArray = this.filteredData.skaters;
                renderFunction = () => this.renderSkatersTable();
                break;
            case 'goalies':
                dataArray = this.filteredData.goalies;
                renderFunction = () => this.renderGoaliesTable();
                break;
            default:
                // Fallback to current tab behavior
                switch(this.currentTab) {
                    case 'teams':
                        dataArray = this.filteredData.teams;
                        renderFunction = () => this.renderTeams();
                        break;
                    case 'games':
                        dataArray = this.filteredData.games;
                        renderFunction = () => this.renderGames();
                        break;
                    case 'players':
                        dataArray = this.filteredData.skaters;
                        renderFunction = () => this.renderSkatersTable();
                        break;
                    default: return;
                }
        }

        if (!dataArray) return;

        // Helper to get nested value
        const getValue = (obj, key) => {
            // Handle special cases for team records
            if (key === 'wins' || key === 'losses' || key === 'ties' || key === 'goals_for' || key === 'goals_against' || key === 'points') {
                // Check if it's in overall record
                if (obj.overall && obj.overall[key] !== undefined) {
                    return obj.overall[key];
                }
            }
            if (key === 'win_pct') {
                // Calculate win percentage
                const record = obj.overall || obj;
                const wins = record.wins || 0;
                const losses = record.losses || 0;
                const ties = record.ties || 0;
                const total = wins + losses + ties;
                if (total === 0) return 0;
                return ((wins * 2 + ties) / (total * 2));
            }
            // Direct property access
            return obj[key];
        };

        // Sort data
        dataArray.sort((a, b) => {
            let aVal = getValue(a, sortKey);
            let bVal = getValue(b, sortKey);

            // Handle null/undefined
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Handle numeric values
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return newSort === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Try to parse as numbers for numeric strings
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return newSort === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // Handle string values
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();

            if (newSort === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        // Reset pagination to page 1 after sorting
        if (tableType === 'teams') this.pagination.teams.page = 1;
        if (tableType === 'games') this.pagination.games.page = 1;
        if (tableType === 'skaters') this.pagination.skaters.page = 1;
        if (tableType === 'goalies') this.pagination.goalies.page = 1;

        // Re-render the specific table
        renderFunction();
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.getElementById('filters').style.display = show ? 'none' : 'flex';
        document.querySelectorAll('.panel').forEach(panel => {
            panel.style.display = show ? 'none' : '';
        });
        if (!show) {
            document.querySelectorAll('.panel')[0].style.display = 'block';
        }
    }

    showError(message) {
        this.showLoading(false);
        const errorDiv = document.getElementById('error');
        const errorMsg = document.getElementById('error-message');
        errorMsg.textContent = message;
        errorDiv.style.display = 'block';
    }

    // ============================================
    // TEAM PAGE FUNCTIONS
    // ============================================

    showTeamPage(teamSeasonId) {
        const team = this.data.teams.find(t => t.id === teamSeasonId);
        if (!team) return;

        // Store current team
        this.currentTeamPageId = teamSeasonId;
        this.currentTeamId = team.team_id;

        // Hide filters
        document.getElementById('filters').style.display = 'none';

        // Hide all other panels and show team page
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById('team-page-panel').classList.add('active');
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        // Update page title
        document.title = `${team.team_name} - MassHSHockey.com`;

        // Populate header
        const initials = (team.team_name || 'T').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('team-page-icon').textContent = initials;
        document.getElementById('team-page-name').textContent = team.team_name;
        document.getElementById('team-page-league').textContent = team.league_name || 'Independent';
        document.getElementById('team-page-division').textContent = team.division_name || '-';
        document.getElementById('team-page-gender').textContent = team.gender === 'F' ? 'Girls' : 'Boys';

        // Populate season selector
        this.populateTeamPageSeasons(team.team_id, team.season_id);

        // Load team data
        this.loadTeamPageRecord(team);
        this.loadTeamPageRoster(team);
        this.loadTeamPageSchedule(team);

        // Reset to Record tab
        this.switchTeamPageTab('record');
    }

    hideTeamPage() {
        // Reset page title
        document.title = 'MassHSHockey.com - Massachusetts High School Hockey';

        // Show filters again
        document.getElementById('filters').style.display = '';

        // Hide team page panel
        document.getElementById('team-page-panel').classList.remove('active');

        // Show the previously active tab
        const activeTab = document.querySelector('.nav-tab.active');
        if (!activeTab) {
            // Default to teams tab
            document.querySelector('.nav-tab[data-tab="teams"]').classList.add('active');
        }
        document.getElementById(`${this.currentTab}-panel`).classList.add('active');
    }

    goBackToTeams() {
        window.location.hash = '';
        this.hideTeamPage();
    }

    populateTeamPageSeasons(teamId, currentSeasonId) {
        const select = document.getElementById('team-page-season');

        // Find all seasons for this team
        const teamSeasons = this.data.teams.filter(t => t.team_id === teamId);
        teamSeasons.sort((a, b) => (parseInt(b.season_id) || 0) - (parseInt(a.season_id) || 0));

        select.innerHTML = '';
        teamSeasons.forEach(ts => {
            const option = document.createElement('option');
            option.value = ts.id;
            option.textContent = ts.season_name || `Season ${ts.season_id}`;
            if (ts.season_id === currentSeasonId) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    changeTeamPageSeason() {
        const select = document.getElementById('team-page-season');
        const newTeamSeasonId = select.value;

        if (newTeamSeasonId && newTeamSeasonId !== this.currentTeamPageId) {
            this.navigateToTeam(newTeamSeasonId);
        }
    }

    switchTeamPageTab(tabName) {
        // Update tabs
        document.querySelectorAll('.team-page-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.team-page-tab[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.team-page-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`team-page-${tabName}`).classList.add('active');
    }

    loadTeamPageRecord(team) {
        const container = document.getElementById('team-page-record-cards');
        const overall = team.overall || {};
        const league = team.league || {};

        const totalGames = (overall.wins || 0) + (overall.losses || 0) + (overall.ties || 0);
        const winPct = totalGames > 0 ?
            (((overall.wins || 0) * 2 + (overall.ties || 0)) / (totalGames * 2) * 100).toFixed(1) : '0.0';

        container.innerHTML = `
            <div class="record-card">
                <div class="record-card-title">Overall Record</div>
                <div class="record-card-value">${overall.wins || 0}-${overall.losses || 0}-${overall.ties || 0}</div>
                <div class="record-card-detail">${winPct}% Win Rate</div>
            </div>
            <div class="record-card">
                <div class="record-card-title">League Record</div>
                <div class="record-card-value">${league.wins || 0}-${league.losses || 0}-${league.ties || 0}</div>
                <div class="record-card-detail">${league.points || 0} Points</div>
            </div>
            <div class="record-card">
                <div class="record-card-title">Goals For</div>
                <div class="record-card-value">${overall.goals_for || 0}</div>
                <div class="record-card-detail">${totalGames > 0 ? (overall.goals_for / totalGames).toFixed(1) : '0.0'} per game</div>
            </div>
            <div class="record-card">
                <div class="record-card-title">Goals Against</div>
                <div class="record-card-value">${overall.goals_against || 0}</div>
                <div class="record-card-detail">${totalGames > 0 ? (overall.goals_against / totalGames).toFixed(1) : '0.0'} per game</div>
            </div>
            <div class="record-card">
                <div class="record-card-title">Point Differential</div>
                <div class="record-card-value">${(overall.goals_for || 0) - (overall.goals_against || 0)}</div>
                <div class="record-card-detail">GF - GA</div>
            </div>
            <div class="record-card">
                <div class="record-card-title">Total Points</div>
                <div class="record-card-value">${overall.points || 0}</div>
                <div class="record-card-detail">2pts Win, 1pt Tie</div>
            </div>
        `;
    }

    loadTeamPageRoster(team) {
        const roster = this.data.players.filter(p =>
            p.team_id === team.team_id && p.season_id === team.season_id
        );

        // Separate skaters and goalies
        const skaters = roster.filter(p => p.position !== 'Goalie');
        const goalies = roster.filter(p => p.position === 'Goalie');

        // Sort skaters by points desc
        skaters.sort((a, b) => (b.points || 0) - (a.points || 0));
        // Sort goalies by GAA asc
        goalies.sort((a, b) => (a.goals_against_average || 99) - (b.goals_against_average || 99));

        const thead = document.getElementById('team-page-roster-thead');
        const tbody = document.getElementById('team-page-roster-tbody');
        const tfoot = document.getElementById('team-page-roster-tfoot');

        // Build header
        thead.innerHTML = `
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Year</th>
                <th>Position</th>
                <th>Hometown</th>
                <th class="text-center">Goals</th>
                <th class="text-center">Assists</th>
                <th class="text-center">Points</th>
                <th class="text-center">GP</th>
                <th class="text-center">PIM</th>
            </tr>
        `;

        if (roster.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#666;">No roster data available</td></tr>';
            tfoot.innerHTML = '';
            return;
        }

        // Calculate totals
        let totalGoals = 0, totalAssists = 0, totalPoints = 0, totalPIM = 0;

        // Build rows for skaters
        let rowsHtml = skaters.map(p => {
            totalGoals += p.goals || 0;
            totalAssists += p.assists || 0;
            totalPoints += p.points || 0;
            totalPIM += p.penalty_minutes || 0;

            return `
                <tr class="clickable" onclick="app.showPlayerDetail('${p.id}')">
                    <td>${p.number || '-'}</td>
                    <td><a href="javascript:void(0)">${this.escapeHtml(p.name)}</a></td>
                    <td>${p.year || '-'}</td>
                    <td>${p.position || '-'}</td>
                    <td>${this.escapeHtml(p.hometown || '-')}</td>
                    <td class="text-center">${p.goals || 0}</td>
                    <td class="text-center">${p.assists || 0}</td>
                    <td class="text-center">${p.points || 0}</td>
                    <td class="text-center">${p.games_played || '-'}</td>
                    <td class="text-center">${p.penalty_minutes || 0}</td>
                </tr>
            `;
        }).join('');

        // Add goalies with different display
        rowsHtml += goalies.map(p => {
            const gaa = p.goals_against_average ? p.goals_against_average.toFixed(2) : '-';
            const svPct = p.save_percentage ? (p.save_percentage * 100).toFixed(1) + '%' : '-';

            return `
                <tr class="clickable goalie-row" onclick="app.showPlayerDetail('${p.id}')">
                    <td>${p.number || '-'}</td>
                    <td><a href="javascript:void(0)">${this.escapeHtml(p.name)}</a></td>
                    <td>${p.year || '-'}</td>
                    <td>Goalie</td>
                    <td>${this.escapeHtml(p.hometown || '-')}</td>
                    <td class="text-center" colspan="3">GAA: ${gaa} | SV%: ${svPct}</td>
                    <td class="text-center">${p.games_played ? p.games_played.toFixed(1) : '-'}</td>
                    <td class="text-center">-</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;

        // Totals row (skaters only)
        tfoot.innerHTML = `
            <tr>
                <td colspan="5">TOTALS</td>
                <td class="text-center">${totalGoals}</td>
                <td class="text-center">${totalAssists}</td>
                <td class="text-center">${totalPoints}</td>
                <td class="text-center">-</td>
                <td class="text-center">${totalPIM}</td>
            </tr>
        `;
    }

    loadTeamPageSchedule(team) {
        const games = this.data.games.filter(g =>
            g.home_team_season_id === team.id || g.away_team_season_id === team.id
        );

        // Sort by date
        games.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const tbody = document.getElementById('team-page-schedule-tbody');

        if (games.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666;">No schedule data available</td></tr>';
            return;
        }

        tbody.innerHTML = games.map(game => {
            const isHome = game.home_team_season_id === team.id;
            const opponent = isHome ? game.away_team : game.home_team;
            const opponentId = isHome ? game.away_team_season_id : game.home_team_season_id;
            const homeAway = isHome ? 'vs' : '@';

            let result = '-';
            let resultClass = '';
            let score = '-';

            if (game.home_score !== null && game.away_score !== null) {
                const teamScore = isHome ? game.home_score : game.away_score;
                const oppScore = isHome ? game.away_score : game.home_score;
                score = `${teamScore}-${oppScore}`;

                if (teamScore > oppScore) {
                    result = 'W';
                    resultClass = 'result-win';
                } else if (teamScore < oppScore) {
                    result = 'L';
                    resultClass = 'result-loss';
                } else {
                    result = 'T';
                    resultClass = 'result-tie';
                }
            }

            return `
                <tr>
                    <td>${this.formatDate(game.date)}</td>
                    <td>${homeAway} <a href="javascript:void(0)" onclick="app.navigateToTeam('${opponentId}')">${this.escapeHtml(opponent)}</a></td>
                    <td class="text-center ${resultClass}">${result}</td>
                    <td class="text-center">${score}</td>
                    <td>${this.escapeHtml(game.venue || '-')}</td>
                </tr>
            `;
        }).join('');
    }

    // Team Detail - Navigate to team page URL
    showTeamDetail(teamSeasonId) {
        this.navigateToTeam(teamSeasonId);
    }

    // Team Detail Modal Functions (kept for reference)
    showTeamDetailModal(teamSeasonId) {
        const team = this.data.teams.find(t => t.id === teamSeasonId);
        if (!team) return;

        // Store current team info for season switching
        this.currentTeamId = team.team_id;
        this.currentTeamSeasonId = teamSeasonId;

        // Populate season selector with all seasons for this team
        this.populateTeamModalSeasons(team.team_id, team.season_id);

        // Set team info
        const genderLabel = team.gender === 'F' ? 'Girls' : 'Boys';
        document.getElementById('modal-team-name').textContent = team.team_name;
        document.getElementById('modal-team-league').textContent = team.league_name || 'Independent';
        document.getElementById('modal-team-division').textContent = `${team.division_name || '-'} (${genderLabel})`;

        // Set record
        const record = team.overall || {};
        const recordHtml = `
            <div class="record-item">
                <span class="record-label">Overall</span>
                <span class="record-value">${record.wins || 0}-${record.losses || 0}-${record.ties || 0}</span>
            </div>
            <div class="record-item">
                <span class="record-label">Points</span>
                <span class="record-value">${record.points || 0}</span>
            </div>
            <div class="record-item">
                <span class="record-label">Goals For</span>
                <span class="record-value">${record.goals_for || 0}</span>
            </div>
            <div class="record-item">
                <span class="record-label">Goals Against</span>
                <span class="record-value">${record.goals_against || 0}</span>
            </div>
            <div class="record-item">
                <span class="record-label">League Record</span>
                <span class="record-value">${team.league?.wins || 0}-${team.league?.losses || 0}-${team.league?.ties || 0}</span>
            </div>
        `;
        document.getElementById('modal-team-record').innerHTML = recordHtml;

        // Load roster
        this.loadTeamRoster(team.team_id, team.season_id);

        // Load schedule
        this.loadTeamSchedule(teamSeasonId, team.team_id);

        // Setup modal tabs
        this.setupModalTabs();

        // Show modal
        document.getElementById('team-modal').style.display = 'flex';
    }

    loadTeamRoster(teamId, seasonId) {
        const roster = this.data.players.filter(p =>
            p.team_id === teamId && p.season_id === seasonId
        );

        // Sort: skaters by points desc, then goalies by GAA
        roster.sort((a, b) => {
            if (a.position === 'Goalie' && b.position !== 'Goalie') return 1;
            if (a.position !== 'Goalie' && b.position === 'Goalie') return -1;
            if (a.position === 'Goalie' && b.position === 'Goalie') {
                return (a.goals_against_average || 99) - (b.goals_against_average || 99);
            }
            return (b.points || 0) - (a.points || 0);
        });

        const tbody = document.getElementById('modal-roster-body');
        if (roster.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#666;">No roster data available for this season</td></tr>';
            return;
        }

        tbody.innerHTML = roster.map(player => {
            const isGoalie = player.position === 'Goalie';
            const gaa = isGoalie && player.goals_against_average ? player.goals_against_average.toFixed(2) : '-';
            const svPct = isGoalie && player.save_percentage ? player.save_percentage.toFixed(1) + '%' : '-';

            return `
                <tr class="player-row ${isGoalie ? 'goalie-row' : ''}" onclick="app.showPlayerDetailFromRoster('${player.id}')" style="cursor: pointer;">
                    <td>${player.number || '-'}</td>
                    <td><a href="javascript:void(0)"><strong>${this.escapeHtml(player.name)}</strong></a></td>
                    <td>${player.position || '-'}</td>
                    <td>${player.year || '-'}</td>
                    <td>${!isGoalie ? (player.goals || 0) : '-'}</td>
                    <td>${!isGoalie ? (player.assists || 0) : '-'}</td>
                    <td>${!isGoalie ? (player.points || 0) : '-'}</td>
                    <td>${gaa}</td>
                    <td>${svPct}</td>
                </tr>
            `;
        }).join('');
    }

    loadTeamSchedule(teamSeasonId, teamId) {
        // Find games where this team_season is involved
        const games = this.data.games.filter(g =>
            g.home_team_season_id === teamSeasonId || g.away_team_season_id === teamSeasonId
        );

        // Sort by date
        games.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const tbody = document.getElementById('modal-schedule-body');
        if (games.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#666;">No schedule data available</td></tr>';
            return;
        }

        tbody.innerHTML = games.map(game => {
            const isHome = game.home_team_season_id === teamSeasonId;
            const opponent = isHome ? game.away_team : game.home_team;
            const homeAway = isHome ? 'vs' : '@';

            let result = '-';
            let resultClass = '';
            if (game.home_score !== null && game.away_score !== null) {
                const teamScore = isHome ? game.home_score : game.away_score;
                const oppScore = isHome ? game.away_score : game.home_score;
                if (teamScore > oppScore) {
                    result = 'W';
                    resultClass = 'win';
                } else if (teamScore < oppScore) {
                    result = 'L';
                    resultClass = 'loss';
                } else {
                    result = 'T';
                    resultClass = 'tie';
                }
            }

            const score = game.home_score !== null ? `${game.home_score}-${game.away_score}` : '-';

            return `
                <tr>
                    <td>${this.formatDate(game.date)}</td>
                    <td>${homeAway} ${this.escapeHtml(opponent)}</td>
                    <td class="${resultClass}">${result}</td>
                    <td>${score}</td>
                    <td>${this.escapeHtml(game.venue || '-')}</td>
                </tr>
            `;
        }).join('');
    }

    setupModalTabs() {
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.onclick = (e) => {
                // Update active tab
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                // Update active panel
                const tabName = e.target.dataset.modalTab;
                document.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`modal-${tabName}`).classList.add('active');
            };
        });

        // Reset to roster tab
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.modal-tab[data-modal-tab="roster"]').classList.add('active');
        document.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('modal-roster').classList.add('active');
    }

    closeTeamModal() {
        document.getElementById('team-modal').style.display = 'none';
    }

    populateTeamModalSeasons(teamId, currentSeasonId) {
        const seasonSelect = document.getElementById('modal-season-filter');

        // Find all seasons for this team
        const teamSeasons = this.data.teams.filter(t => t.team_id === teamId);

        // Sort by season (most recent first)
        teamSeasons.sort((a, b) => {
            const aNum = parseInt(a.season_id) || 0;
            const bNum = parseInt(b.season_id) || 0;
            return bNum - aNum;
        });

        // Populate dropdown
        seasonSelect.innerHTML = '';
        teamSeasons.forEach(ts => {
            const option = document.createElement('option');
            option.value = ts.id; // team_season_id
            option.textContent = ts.season_name || `Season ${ts.season_id}`;
            if (ts.season_id === currentSeasonId) {
                option.selected = true;
            }
            seasonSelect.appendChild(option);
        });
    }

    changeTeamModalSeason() {
        const seasonSelect = document.getElementById('modal-season-filter');
        const newTeamSeasonId = seasonSelect.value;

        if (newTeamSeasonId && newTeamSeasonId !== this.currentTeamSeasonId) {
            // Reload the modal with the new season's data
            this.showTeamDetail(newTeamSeasonId);
        }
    }

    showPlayerDetailFromRoster(playerId) {
        // Close team modal and show player modal
        this.closeTeamModal();
        this.showPlayerDetail(playerId);
    }

    // Player Detail Modal Functions
    showPlayerDetail(playerId) {
        const player = this.data.players.find(p => p.id === playerId);
        if (!player) return;

        // Store current player for viewPlayerTeam function
        this.currentPlayer = player;
        this.currentPlayerId = playerId;

        // Set player header info
        document.getElementById('modal-player-name').textContent = player.name;
        document.getElementById('modal-player-team').textContent = player.team_name || '-';
        document.getElementById('modal-player-position').textContent = player.position || '-';
        document.getElementById('modal-player-number').textContent = player.number || '-';
        document.getElementById('modal-player-year').textContent = player.year || '-';
        document.getElementById('modal-player-hometown').textContent = player.hometown || '-';

        // Build player history table
        this.buildPlayerHistoryTable(player.name);

        // Show modal
        document.getElementById('player-modal').style.display = 'flex';
    }

    buildPlayerHistoryTable(playerName) {
        // Find all records for this player by name
        const playerSeasons = this.data.players.filter(p => p.name === playerName);

        // Sort by season (most recent first)
        playerSeasons.sort((a, b) => {
            const aNum = parseInt(a.season_id) || 0;
            const bNum = parseInt(b.season_id) || 0;
            return bNum - aNum;
        });

        // Determine if player is a goalie (check if any season has goalie position)
        const isGoalie = playerSeasons.some(p => p.position === 'Goalie');

        const thead = document.getElementById('player-history-thead');
        const tbody = document.getElementById('player-history-tbody');
        const tfoot = document.getElementById('player-history-tfoot');

        if (isGoalie) {
            // Goalie table headers
            thead.innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Season</th>
                    <th>Year</th>
                    <th>Team</th>
                    <th class="text-center">GP</th>
                    <th class="text-center">GA</th>
                    <th class="text-center">GAA</th>
                    <th class="text-center">Saves</th>
                    <th class="text-center">SV%</th>
                    <th class="text-center">SO</th>
                </tr>
            `;

            // Goalie table rows
            let totalGP = 0, totalGA = 0, totalSaves = 0, totalSO = 0;

            tbody.innerHTML = playerSeasons.map((ps, index) => {
                const gp = ps.games_played || 0;
                const ga = ps.goals_against || 0;
                const saves = ps.saves || 0;
                const so = ps.shutouts || 0;
                const gaa = ps.goals_against_average ? ps.goals_against_average.toFixed(2) : '-';
                const svPct = ps.save_percentage ? (ps.save_percentage * 100).toFixed(1) : '-';

                totalGP += gp;
                totalGA += ga;
                totalSaves += saves;
                totalSO += so;

                return `
                    <tr>
                        <td>${ps.number || '-'}</td>
                        <td><a href="javascript:void(0)" onclick="app.navigateToPlayerSeason('${ps.id}')">${ps.season_name || '-'}</a></td>
                        <td>${ps.year || '-'}</td>
                        <td><a href="javascript:void(0)" onclick="app.viewPlayerTeamBySeason('${ps.team_id}', '${ps.season_id}')">${this.escapeHtml(ps.team_name || '-')}</a></td>
                        <td class="text-center">${gp.toFixed ? gp.toFixed(1) : gp}</td>
                        <td class="text-center">${ga}</td>
                        <td class="text-center">${gaa}</td>
                        <td class="text-center">${saves}</td>
                        <td class="text-center">${svPct}</td>
                        <td class="text-center">${so}</td>
                    </tr>
                `;
            }).join('');

            // Totals row
            const totalGAA = totalGP > 0 ? (totalGA / totalGP).toFixed(2) : '-';
            const totalShots = playerSeasons.reduce((sum, p) => sum + (p.shots || 0), 0);
            const totalSvPct = totalShots > 0 ? ((totalSaves / totalShots) * 100).toFixed(1) : '-';

            tfoot.innerHTML = `
                <tr>
                    <td colspan="4">TOTALS</td>
                    <td class="text-center">${totalGP.toFixed ? totalGP.toFixed(1) : totalGP}</td>
                    <td class="text-center">${totalGA}</td>
                    <td class="text-center">${totalGAA}</td>
                    <td class="text-center">${totalSaves}</td>
                    <td class="text-center">${totalSvPct}</td>
                    <td class="text-center">${totalSO}</td>
                </tr>
            `;
        } else {
            // Skater table headers
            thead.innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Season</th>
                    <th>Year</th>
                    <th>Position</th>
                    <th>Team</th>
                    <th class="text-center">Goals</th>
                    <th class="text-center">Assists</th>
                    <th class="text-center">Points</th>
                    <th class="text-center">GP</th>
                    <th class="text-center">PIM</th>
                </tr>
            `;

            // Skater table rows
            let totalGoals = 0, totalAssists = 0, totalPoints = 0, totalGP = 0, totalPIM = 0;

            tbody.innerHTML = playerSeasons.map((ps, index) => {
                const goals = ps.goals || 0;
                const assists = ps.assists || 0;
                const points = ps.points || 0;
                const gp = ps.games_played || 0;
                const pim = ps.penalty_minutes || 0;

                totalGoals += goals;
                totalAssists += assists;
                totalPoints += points;
                totalGP += gp;
                totalPIM += pim;

                return `
                    <tr>
                        <td>${ps.number || '-'}</td>
                        <td><a href="javascript:void(0)" onclick="app.navigateToPlayerSeason('${ps.id}')">${ps.season_name || '-'}</a></td>
                        <td>${ps.year || '-'}</td>
                        <td>${ps.position || '-'}</td>
                        <td><a href="javascript:void(0)" onclick="app.viewPlayerTeamBySeason('${ps.team_id}', '${ps.season_id}')">${this.escapeHtml(ps.team_name || '-')}</a></td>
                        <td class="text-center">${goals}</td>
                        <td class="text-center">${assists}</td>
                        <td class="text-center">${points}</td>
                        <td class="text-center">${gp}</td>
                        <td class="text-center">${pim}</td>
                    </tr>
                `;
            }).join('');

            // Totals row
            tfoot.innerHTML = `
                <tr>
                    <td colspan="5">TOTALS</td>
                    <td class="text-center">${totalGoals}</td>
                    <td class="text-center">${totalAssists}</td>
                    <td class="text-center">${totalPoints}</td>
                    <td class="text-center">${totalGP}</td>
                    <td class="text-center">${totalPIM}</td>
                </tr>
            `;
        }
    }

    navigateToPlayerSeason(playerId) {
        // Update the current player display to the selected season
        this.showPlayerDetail(playerId);
    }

    viewPlayerTeamBySeason(teamId, seasonId) {
        // Find the team_season for this team and season
        const teamSeason = this.data.teams.find(t =>
            t.team_id === teamId && t.season_id === seasonId
        );

        if (teamSeason) {
            this.closePlayerModal();
            this.navigateToTeam(teamSeason.id);
        }
    }

    closePlayerModal() {
        document.getElementById('player-modal').style.display = 'none';
    }

    viewPlayerTeam() {
        if (!this.currentPlayer) return;

        // Find the team_season for this player's team and season
        const teamSeason = this.data.teams.find(t =>
            t.team_id === this.currentPlayer.team_id &&
            t.season_id === this.currentPlayer.season_id
        );

        if (teamSeason) {
            this.closePlayerModal();
            this.navigateToTeam(teamSeason.id);
        }
    }
}

// Global app reference for onclick handlers
let app;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new HockeyDataApp();
    });
} else {
    app = new HockeyDataApp();
}
