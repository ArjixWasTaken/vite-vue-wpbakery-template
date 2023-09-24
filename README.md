# vite-vue-wpbakery-template

## Project setup

```
pnpm install
pnpm build
```

> [!WARNING]  
> The name of the plugin folder is used to resolve the plugin's assets, whenever you rename the folder you need to rebuild the plugin.

## Development

To create a new wpbakery component, all you need to do is create a new `.vue` file in the `src/components` folder.

> [!IMPORTANT]  
> Within the `.vue` file, you must define the props that the component will receive, if there are no props then `defineProps({})` will suffice, it is hardcoded to look for it right now.

## Credits

Huge thanks to [wp-boilerplate-vue-with-vite](https://github.com/hasanuzzamanbe/wp-boilerplate-vue-with-vite) for the inspiration and the base of this project.

## Note

Whilst this template should work fine without [WPBakery](https://wpbakery.com/), it is heavily recommended to use it.
