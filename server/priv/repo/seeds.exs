alias GolfStatsServer.Repo
alias GolfStatsServer.{Round, Hole}
alias GolfStatsServer.Bag.{Club, ClubDefinition}
alias GolfStatsServer.Accounts.User

# Clear existing data
Repo.delete_all(Hole)
Repo.delete_all(Round)
Repo.delete_all(Club)
Repo.delete_all(ClubDefinition)
Repo.delete_all(User)

# Create Club Definitions
definitions = [
  # Woods
  %{category: "Woods", name: "Driver", type: "driver", default_selected: true, sort_order: 1},
  %{category: "Woods", name: "3 Wood", type: "wood", default_selected: true, sort_order: 2},
  %{category: "Woods", name: "5 Wood", type: "wood", default_selected: false, sort_order: 3},
  %{category: "Woods", name: "7 Wood", type: "wood", default_selected: false, sort_order: 4},
  
  # Hybrids
  %{category: "Hybrids", name: "2 Hybrid", type: "hybrid", default_selected: false, sort_order: 5},
  %{category: "Hybrids", name: "3 Hybrid", type: "hybrid", default_selected: false, sort_order: 6},
  %{category: "Hybrids", name: "4 Hybrid", type: "hybrid", default_selected: false, sort_order: 7},
  %{category: "Hybrids", name: "5 Hybrid", type: "hybrid", default_selected: false, sort_order: 8},

  # Irons
  %{category: "Irons", name: "2 Iron", type: "iron", default_selected: false, sort_order: 9},
  %{category: "Irons", name: "3 Iron", type: "iron", default_selected: false, sort_order: 10},
  %{category: "Irons", name: "4 Iron", type: "iron", default_selected: true, sort_order: 11},
  %{category: "Irons", name: "5 Iron", type: "iron", default_selected: true, sort_order: 12},
  %{category: "Irons", name: "6 Iron", type: "iron", default_selected: true, sort_order: 13},
  %{category: "Irons", name: "7 Iron", type: "iron", default_selected: true, sort_order: 14},
  %{category: "Irons", name: "8 Iron", type: "iron", default_selected: true, sort_order: 15},
  %{category: "Irons", name: "9 Iron", type: "iron", default_selected: true, sort_order: 16},

  # Wedges
  %{category: "Wedges", name: "PW", type: "wedge", default_selected: true, sort_order: 17},
  %{category: "Wedges", name: "GW", type: "wedge", default_selected: false, sort_order: 18},
  %{category: "Wedges", name: "50°", type: "wedge", default_selected: false, sort_order: 19},
  %{category: "Wedges", name: "52°", type: "wedge", default_selected: false, sort_order: 20},
  %{category: "Wedges", name: "SW", type: "wedge", default_selected: true, sort_order: 21},
  %{category: "Wedges", name: "54°", type: "wedge", default_selected: false, sort_order: 22},
  %{category: "Wedges", name: "56°", type: "wedge", default_selected: false, sort_order: 23},
  %{category: "Wedges", name: "LW", type: "wedge", default_selected: false, sort_order: 24},
  %{category: "Wedges", name: "58°", type: "wedge", default_selected: false, sort_order: 25},
  %{category: "Wedges", name: "60°", type: "wedge", default_selected: false, sort_order: 26},

  # Putter
  %{category: "Putter", name: "Putter", type: "putter", default_selected: true, sort_order: 27}
]

Enum.each(definitions, fn attrs ->
  %ClubDefinition{}
  |> ClubDefinition.changeset(attrs)
  |> Repo.insert!()
end)

# Create Default User
{:ok, user} = Repo.insert(%User{username: "demo"})
{:ok, user2} = Repo.insert(%User{username: "demo2"})

# Create Clubs (simulating a bag from definitions)
# We can just pick some from definitions
defs = Repo.all(ClubDefinition)
default_clubs = Enum.filter(defs, & &1.default_selected)

clubs =
  Enum.map(default_clubs, fn def ->
    %Club{}
    |> Club.changeset(%{name: def.name, type: def.type, user_id: user.id})
    |> Repo.insert!()
  end)

# Reuse the round generation logic from before...
# (I'll just paste the rest of the original logic if needed, but for now this is enough to seed the critical parts)
# Actually, I should keep the round generation logic because it's useful for the user.
# I will re-add the round generation logic but updated to use the clubs we just created.

generate_holes = fn profile, clubs_list ->
  driver = Enum.find(clubs_list, &(&1.type == "driver"))
  woods = Enum.filter(clubs_list, &(&1.type == "wood"))
  hybrids = Enum.filter(clubs_list, &(&1.type == "hybrid"))
  irons = Enum.filter(clubs_list, &(&1.type == "iron"))
  wedges = Enum.filter(clubs_list, &(&1.type == "wedge"))
  putter = Enum.find(clubs_list, &(&1.type == "putter"))

  Enum.map(1..18, fn hole_num ->
    par = Enum.at([4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4], hole_num - 1)

    # Logic based on profile
    {score, putts, fairway_status, gir_status, proximity, fw_bunker, gs_bunker} =
      case profile do
        :good ->
          gir = Enum.random([true, true, true, false])
          fw_status = if par > 3, do: Enum.random(["hit", "hit", "hit", "left"]), else: nil

          {score, putts, prox} =
            if gir do
              {par + Enum.random([-1, 0]), Enum.random([1, 2]), Enum.random(5..25)}
            else
              {par + Enum.random([0, 1]), Enum.random([1, 1, 2]), nil}
            end

          {score, putts, fw_status, if(gir, do: "hit", else: "short"), prox, false, false}

        :average ->
          gir = Enum.random([true, false, false])
          fw_status = if par > 3, do: Enum.random(["hit", "left", "right"]), else: nil

          {score, putts, prox} =
            if gir do
              {par, 2, Enum.random(20..45)}
            else
              {par + Enum.random([1, 2]), Enum.random([2, 3]), nil}
            end

          {score, putts, fw_status, if(gir, do: "hit", else: "right"), prox,
           Enum.random([true, false]), Enum.random([true, false])}

        :scramble ->
          fw_status = if par > 3, do: Enum.random(["left", "right"]), else: nil
          putts = 1
          score = par + Enum.random([0, 1])

          {score, putts, fw_status, "short", nil, true, true}
      end

    # Simulate Club Selection
    club_ids =
      cond do
        par == 3 ->
          tee_shot = Enum.random(irons ++ hybrids)
          approach = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id] ++ Enum.map(approach, & &1.id) ++ [putter.id]

        par == 4 ->
          tee_shot = driver
          approach_club =
            if proximity && proximity < 150, do: Enum.random(wedges), else: Enum.random(irons)

          recovery = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id, approach_club.id] ++ Enum.map(recovery, & &1.id) ++ [putter.id]

        par == 5 ->
          tee_shot = driver
          layup = Enum.random(woods ++ hybrids)
          approach_club = Enum.random(wedges)
          recovery = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id, layup.id, approach_club.id] ++ Enum.map(recovery, & &1.id) ++ [putter.id]
      end

    %{
      hole_number: hole_num,
      par: par,
      score: score,
      putts: putts,
      fairway_status: fairway_status,
      gir_status: gir_status,
      proximity_to_hole: proximity,
      fairway_bunker: fw_bunker,
      greenside_bunker: gs_bunker,
      fairway_hit: fairway_status == "hit",
      gir: gir_status == "hit",
      club_ids: club_ids
    }
  end)
end

# Round 1
date1 = ~D[2023-10-15]
holes1 = generate_holes.(:good, clubs)
total_score1 = Enum.reduce(holes1, 0, fn h, acc -> acc + h.score end)

%Round{}
|> Round.changeset(%{
  course_name: "Pebble Beach",
  date: date1,
  total_score: total_score1,
  created_at: DateTime.new!(date1, ~T[08:00:00]),
  ended_at: DateTime.new!(date1, ~T[12:30:00]),
  holes: holes1,
  user_id: user.id
})
|> Repo.insert!()

IO.puts("Seeded clubs and rounds successfully!")
