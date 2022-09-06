import {
    Grid, // our UI Component to display the results
    SearchBar, // the search bar the user will type into
    SearchContext, // the context that wraps and connects our components
    SearchContextManager, // the context manager, includes the Context.Provider
    SuggestionBar, // an optional UI component that displays trending searches and channel / username results
} from '@giphy/react-components'
import { useContext } from 'react';
import { isBrowser, MobileOnlyView, BrowserView } from 'react-device-detect';

const GiphyGrid: React.FC<{onGiphySelect?: any}> = ({onGiphySelect}) => {
    const { fetchGifs, searchKey } = useContext(SearchContext);
    const gifSend = (gif: any,e: { preventDefault: () => void; }) => {
        e.preventDefault();
        onGiphySelect(gif)
    }
    return (
        <>
            <div className='GifSearchbar'>
            <MobileOnlyView>
            <SearchBar placeholder='Search Here' />
            </MobileOnlyView>

            <BrowserView>
            <SearchBar autoFocus={true} placeholder='Search Here' />
            </BrowserView>
            
            </div>
            
            {/** 
                key will recreate the component, 
                this is important for when you change fetchGifs 
                e.g. changing from search term dogs to cats or type gifs to stickers
                you want to restart the gifs from the beginning and changing a component's key does that 
            **/}
            <Grid key={searchKey} hideAttribution={true} onGifClick={gifSend} columns={isBrowser ? 5 : 2} width={ isBrowser ? 1200 : 360 } fetchGifs={fetchGifs} />

        </>
    )
}

export default GiphyGrid;