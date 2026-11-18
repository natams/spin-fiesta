# Spin Fiesta: free-to-play roulette demo

A play-money roulette demo built with plain HTML, CSS and JavaScript. No libraries, no JSON files, no real payments.

## Rules
- New players get a welcome popup and claim 5 coins. Returning players claim 2 coins once per day.
- Every bet costs 1 coin. Place up to 6 bets per spin on red, black or any number from 0 to 36.
- Red or black pays 3 coins. A number pays 40 coins.
- Win in a row to build a streak and earn bonus coins.
- When the coins run out, a popup offers to come back tomorrow for 2 coins or buy more (demo only).
- Coins can be redeemed for demo prizes. Prizes have no cash value.

## Where the content lives
Everything is in `index.html`: headlines, bets, payouts, coin packs, prizes, popups and every message the game shows. Change a number in the HTML and the game follows. The main settings are the `data-` attributes on the `#app` element: starter coins, daily coins, bet cost, maximum bets, big and mega win sizes, and streak bonus.

## Try it
- Open `index.html` in a browser.
- Add `?variant=B` to the address to see the second headline (A/B test).
- Open "Demo tools and event log" at the bottom to skip to tomorrow (tests daily coins), reset the demo, and watch tracked events.

## Details
- Responsive layout: stacked on mobile, two columns on desktop.
- Win celebrations: confetti, coin rain, win banner tiers, streak counter, sound (can be switched off).
- Progress is saved in the browser (`localStorage`), with a memory fallback if storage is blocked.
- Double clicks are blocked while the wheel is spinning.
- Respects reduced-motion settings and works with a keyboard.
- Tracked events: page_view, variant_assigned, welcome_shown, welcome_bonus, daily_shown, daily_bonus, bet_added, bet_removed, spin_start, spin_result, win_big, win_mega, out_of_coins, buy_open, buy_confirm, redeem_open, redeem_confirm.

## Strategy and next steps
[Add your own notes here: what problem the design solves, what you would test next, and what you would measure.]

## Disclaimer
Portfolio demo only. All coins are play money and prizes have no cash value.
